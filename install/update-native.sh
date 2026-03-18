#!/usr/bin/env bash
# =============================================================================
# Atualizador Native (PM2) - modelo atomico releases/current/shared
# =============================================================================
# Estrutura:
#   BASE_DIR/releases/<version>
#   BASE_DIR/shared
#   BASE_DIR/current  -> release ativo
#   BASE_DIR/previous -> release anterior
#
# Exit codes padronizados:
#   0  success
#   10 lock already held
#   20 backup failed
#   30 download/checkout failed
#   40 build/migrations failed
#   50 healthcheck failed + rollback succeeded
#   60 healthcheck failed + rollback failed
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

TARGET_TAG="${TARGET_TAG:-${RELEASE_TAG:-latest}}"
APP_BASE_DIR="${APP_BASE_DIR:-}"
GIT_REPO_URL="${GIT_REPO_URL:-}"
GIT_AUTH_HEADER="${GIT_AUTH_HEADER:-}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
RELEASES_TO_KEEP="${RELEASES_TO_KEEP:-5}"
MAINTENANCE_ETA_SECONDS="${MAINTENANCE_ETA_SECONDS:-300}"
LEGACY_INPLACE="false"

EXIT_SUCCESS=0
EXIT_LOCK_HELD=10
EXIT_BACKUP_FAILED=20
EXIT_DOWNLOAD_FAILED=30
EXIT_BUILD_FAILED=40
EXIT_HEALTH_ROLLBACK_OK=50
EXIT_HEALTH_ROLLBACK_FAILED=60

BASE_DIR=""
RELEASES_DIR=""
SHARED_DIR=""
CURRENT_LINK=""
PREVIOUS_LINK=""
LOCK_FILE=""
LOCK_FD=99
LOCK_ACQUIRED="false"

STATE_FILE=""
UPDATE_LOG_FILE=""
MAINTENANCE_FILE=""
STATE_INITIALIZED="false"
STATE_FINALIZED="false"

CURRENT_STEP="init"
STATE_STATUS="idle"
STATE_STARTED_AT=""
STATE_FINISHED_AT=""
STATE_FROM_VERSION="unknown"
STATE_TO_VERSION="unknown"
STATE_STEP="init"
STATE_PROGRESS=0
STATE_LOCK="false"
STATE_LAST_ERROR=""
ROLLBACK_ATTEMPTED="false"
ROLLBACK_COMPLETED="false"
ROLLBACK_REASON=""
MAINTENANCE_ACTIVE="false"
MAINTENANCE_STARTED_AT=""

RESOLVED_APP_VERSION="unknown"
RESOLVED_GIT_SHA="unknown"
RESOLVED_BUILD_TIME="unknown"
RESOLVED_BRANCH=""

BACKEND_PROC=""
FRONTEND_PROC=""

now_iso() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

log() {
  echo "[$(now_iso)] [${CURRENT_STEP}] $*"
}

log_err() {
  echo "[$(now_iso)] [${CURRENT_STEP}] ERROR: $*" >&2
}

usage() {
  cat <<'EOF'
Uso:
  bash install/update-native.sh [opcoes]

Opcoes:
  --tag <tag>            Define tag alvo (padrao: env TARGET_TAG/RELEASE_TAG)
  --base-dir <dir>       Define BASE_DIR (padrao: APP_BASE_DIR ou autodetect)
  --legacy-inplace       Executa update antigo in-place (compatibilidade)
  --help                 Mostra ajuda
EOF
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/ }"
  value="${value//$'\r'/ }"
  echo "$value"
}

json_or_null() {
  local value="${1:-}"
  if [[ -z "$value" ]]; then
    echo "null"
  else
    echo "\"$(json_escape "$value")\""
  fi
}

write_maintenance_file() {
  local enabled="$1"
  local reason="${2:-}"
  local eta_seconds="${3:-$MAINTENANCE_ETA_SECONDS}"

  if ! [[ "$eta_seconds" =~ ^[0-9]+$ ]]; then
    eta_seconds="$MAINTENANCE_ETA_SECONDS"
  fi
  if ! [[ "$eta_seconds" =~ ^[0-9]+$ ]]; then
    eta_seconds="300"
  fi

  if [[ -z "$MAINTENANCE_FILE" ]]; then
    return 0
  fi

  mkdir -p "$(dirname "$MAINTENANCE_FILE")"

  if [[ "$enabled" == "true" ]] && [[ -z "$MAINTENANCE_STARTED_AT" ]]; then
    MAINTENANCE_STARTED_AT="$(now_iso)"
  fi

  if [[ "$enabled" != "true" ]]; then
    MAINTENANCE_STARTED_AT=""
  fi

  local tmp_file="${MAINTENANCE_FILE}.tmp.$$"
  cat > "$tmp_file" <<EOF
{
  "enabled": ${enabled},
  "reason": $(json_or_null "$reason"),
  "startedAt": $(json_or_null "$MAINTENANCE_STARTED_AT"),
  "etaSeconds": ${eta_seconds},
  "allowedRoles": ["SUPER_ADMIN"],
  "bypassHeader": "X-Maintenance-Bypass"
}
EOF
  mv -f "$tmp_file" "$MAINTENANCE_FILE"
}

enable_maintenance_mode() {
  local reason="$1"
  local eta_seconds="${2:-$MAINTENANCE_ETA_SECONDS}"
  MAINTENANCE_ACTIVE="true"
  write_maintenance_file "true" "$reason" "$eta_seconds"
  log "Maintenance mode ativado. reason=${reason}"
}

disable_maintenance_mode() {
  local reason="${1:-Update concluido com sucesso}"
  MAINTENANCE_ACTIVE="false"
  write_maintenance_file "false" "$reason" "0"
  log "Maintenance mode desativado. reason=${reason}"
}

ensure_maintenance_on_failure() {
  local reason="$1"
  if [[ "$MAINTENANCE_ACTIVE" == "true" ]]; then
    write_maintenance_file "true" "$reason" "$MAINTENANCE_ETA_SECONDS"
    log_err "Maintenance mode mantido ativo apos falha: ${reason}"
  fi
}
sanitize_release_name() {
  local value="$1"
  value="${value//\//_}"
  value="${value// /_}"
  value="$(echo "$value" | tr -cd '[:alnum:]._+-')"
  if [[ -z "$value" ]]; then
    value="unknown"
  fi
  echo "$value"
}

write_state_file() {
  if [[ "$STATE_INITIALIZED" != "true" ]] || [[ -z "$STATE_FILE" ]]; then
    return 0
  fi

  local tmp_file
  tmp_file="${STATE_FILE}.tmp.$$"
  cat > "$tmp_file" <<EOF
{
  "status": "$(json_escape "$STATE_STATUS")",
  "startedAt": $(json_or_null "$STATE_STARTED_AT"),
  "finishedAt": $(json_or_null "$STATE_FINISHED_AT"),
  "fromVersion": "$(json_escape "$STATE_FROM_VERSION")",
  "toVersion": "$(json_escape "$STATE_TO_VERSION")",
  "step": "$(json_escape "$STATE_STEP")",
  "progress": ${STATE_PROGRESS},
  "lock": ${STATE_LOCK},
  "lastError": $(json_or_null "$STATE_LAST_ERROR"),
  "rollback": {
    "attempted": ${ROLLBACK_ATTEMPTED},
    "completed": ${ROLLBACK_COMPLETED},
    "reason": $(json_or_null "$ROLLBACK_REASON")
  }
}
EOF
  mv -f "$tmp_file" "$STATE_FILE"
}

set_step() {
  local step="$1"
  local progress="$2"
  CURRENT_STEP="$step"
  STATE_STEP="$step"
  STATE_PROGRESS="$progress"
  write_state_file
}

start_state() {
  STATE_INITIALIZED="true"
  STATE_STATUS="running"
  STATE_STARTED_AT="$(now_iso)"
  STATE_FINISHED_AT=""
  STATE_FROM_VERSION="unknown"
  STATE_TO_VERSION="$TARGET_TAG"
  STATE_STEP="starting"
  CURRENT_STEP="starting"
  STATE_PROGRESS=1
  STATE_LOCK="true"
  STATE_LAST_ERROR=""
  ROLLBACK_ATTEMPTED="false"
  ROLLBACK_COMPLETED="false"
  ROLLBACK_REASON=""
  write_state_file
}

finish_success() {
  STATE_STATUS="success"
  STATE_FINISHED_AT="$(now_iso)"
  STATE_PROGRESS=100
  STATE_LOCK="false"
  STATE_LAST_ERROR=""
  STATE_FINALIZED="true"
  set_step "completed" 100
  write_state_file
}

finish_failed() {
  local code="$1"
  local message="$2"
  STATE_STATUS="failed"
  STATE_FINISHED_AT="$(now_iso)"
  STATE_LOCK="false"
  STATE_LAST_ERROR="$message"
  STATE_FINALIZED="true"
  write_state_file
  log_err "${message} (exit_code=${code})"
}

finish_rolled_back() {
  local message="$1"
  STATE_STATUS="rolled_back"
  STATE_FINISHED_AT="$(now_iso)"
  STATE_PROGRESS=100
  STATE_LOCK="false"
  STATE_LAST_ERROR="$message"
  STATE_FINALIZED="true"
  set_step "rollback" 100
  write_state_file
}

fail_and_exit() {
  local code="$1"
  local message="$2"
  if [[ "$STATE_INITIALIZED" == "true" ]]; then
    finish_failed "$code" "$message"
  else
    log_err "${message} (exit_code=${code})"
  fi
  exit "$code"
}

ensure_command() {
  local cmd="$1"
  local code="${2:-$EXIT_BUILD_FAILED}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail_and_exit "$code" "Comando obrigatorio nao encontrado: $cmd"
  fi
}

rotate_update_log() {
  local max_size=$((5 * 1024 * 1024))
  local max_files=10
  local file="$UPDATE_LOG_FILE"

  mkdir -p "$(dirname "$file")"
  if [[ ! -f "$file" ]]; then
    return 0
  fi

  local size=0
  size="$(wc -c < "$file" 2>/dev/null || echo 0)"
  if (( size < max_size )); then
    return 0
  fi

  local i=0
  for ((i=max_files-1; i>=1; i--)); do
    if [[ -f "${file}.${i}" ]]; then
      mv -f "${file}.${i}" "${file}.$((i + 1))"
    fi
  done
  mv -f "$file" "${file}.1"
}

normalize_repo_web_url() {
  local raw="$1"
  local normalized="$raw"
  normalized="${normalized%.git}"
  if [[ "$normalized" =~ ^git@github.com:(.+/.+)$ ]]; then
    normalized="https://github.com/${BASH_REMATCH[1]}"
  fi
  echo "$normalized"
}

resolve_base_dir() {
  local candidate="${APP_BASE_DIR}"
  if [[ -z "$candidate" ]]; then
    candidate="$PROJECT_ROOT"
    if [[ "$(basename "$candidate")" == "current" ]]; then
      candidate="$(dirname "$candidate")"
    elif [[ "$(basename "$(dirname "$candidate")")" == "releases" ]]; then
      candidate="$(dirname "$(dirname "$candidate")")"
    fi
  fi

  BASE_DIR="$(cd "$candidate" && pwd)"
  RELEASES_DIR="$BASE_DIR/releases"
  SHARED_DIR="$BASE_DIR/shared"
  CURRENT_LINK="$BASE_DIR/current"
  PREVIOUS_LINK="$BASE_DIR/previous"
  LOCK_FILE="$SHARED_DIR/locks/update.lock"
  STATE_FILE="$SHARED_DIR/update-state.json"
  UPDATE_LOG_FILE="$SHARED_DIR/logs/update.log"
  MAINTENANCE_FILE="$SHARED_DIR/maintenance.json"
}

prepare_base_layout() {
  mkdir -p "$RELEASES_DIR" "$SHARED_DIR/uploads" "$SHARED_DIR/backups" "$SHARED_DIR/logs" "$SHARED_DIR/locks"
}

initialize_logging_and_state() {
  rotate_update_log
  exec > >(tee -a "$UPDATE_LOG_FILE") 2>&1
}

acquire_lock() {
  eval "exec ${LOCK_FD}>\"${LOCK_FILE}\""
  if ! flock -n "$LOCK_FD"; then
    log_err "Update em andamento. Lock ativo em $LOCK_FILE"
    exit "$EXIT_LOCK_HELD"
  fi

  LOCK_ACQUIRED="true"
  STATE_LOCK="true"
  write_state_file
}

release_lock() {
  if [[ "$LOCK_ACQUIRED" == "true" ]]; then
    flock -u "$LOCK_FD" || true
    eval "exec ${LOCK_FD}>&-"
    LOCK_ACQUIRED="false"
  fi
}

get_link_target() {
  local link_path="$1"
  if [[ -L "$link_path" ]]; then
    readlink -f "$link_path"
  else
    echo ""
  fi
}

update_env_file() {
  local key="$1"
  local value="$2"
  local file="$3"
  local escaped_key
  escaped_key="$(printf '%s\n' "$key" | sed 's/[][\/.^$*]/\\&/g')"

  if grep -qE "^${escaped_key}=" "$file" 2>/dev/null; then
    sed -i "s|^${escaped_key}=.*|${key}=${value}|g" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

read_env_file_value() {
  local key="$1"
  local file="$2"
  if [[ ! -f "$file" ]]; then
    return 1
  fi

  local line=""
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi

  line="${line#*=}"
  line="${line%$'\r'}"
  if [[ "${#line}" -ge 2 && "${line:0:1}" == "\"" && "${line: -1}" == "\"" ]]; then
    line="${line:1:${#line}-2}"
  elif [[ "${#line}" -ge 2 && "${line:0:1}" == "'" && "${line: -1}" == "'" ]]; then
    line="${line:1:${#line}-2}"
  fi

  printf '%s\n' "$line"
}

ensure_required_security_secrets() {
  local env_file="$1"
  local jwt_secret=""
  local encryption_key=""
  local trusted_device_secret=""

  jwt_secret="$(read_env_file_value "JWT_SECRET" "$env_file" || true)"
  encryption_key="$(read_env_file_value "ENCRYPTION_KEY" "$env_file" || true)"
  trusted_device_secret="$(read_env_file_value "TRUSTED_DEVICE_TOKEN_SECRET" "$env_file" || true)"

  if [[ -z "$jwt_secret" ]]; then
    log_err "JWT_SECRET ausente em $env_file. Update abortado."
    return 1
  fi

  if [[ -z "$encryption_key" ]]; then
    log_err "ENCRYPTION_KEY ausente em $env_file. Update abortado para evitar quebra do fluxo 2FA."
    return 1
  fi

  if [[ -z "$trusted_device_secret" ]]; then
    trusted_device_secret="$(openssl rand -hex 32)"
    update_env_file "TRUSTED_DEVICE_TOKEN_SECRET" "$trusted_device_secret" "$env_file"
    log "TRUSTED_DEVICE_TOKEN_SECRET ausente; segredo dedicado gerado e persistido em $env_file"
    return 0
  fi

  if [[ "$trusted_device_secret" == "$jwt_secret" ]]; then
    log_err "TRUSTED_DEVICE_TOKEN_SECRET nao pode reutilizar JWT_SECRET em $env_file. Update abortado."
    return 1
  fi

  return 0
}

validate_release_dir() {
  local release_dir="$1"
  [[ -f "$release_dir/pnpm-workspace.yaml" ]] &&
  [[ -f "$release_dir/package.json" ]] &&
  [[ -d "$release_dir/apps/backend" ]] &&
  [[ -d "$release_dir/apps/frontend" ]] &&
  [[ -d "$release_dir/install" ]]
}

bootstrap_legacy_layout_if_needed() {
  if [[ -L "$CURRENT_LINK" ]]; then
    return 0
  fi

  if [[ -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]]; then
    log_err "Caminho $CURRENT_LINK existe mas nao eh symlink. Ajuste manual necessario."
    return 1
  fi

  if [[ ! -d "$PROJECT_ROOT/apps/backend" ]]; then
    log_err "Nao foi possivel detectar raiz legacy para bootstrap (apps/backend ausente em $PROJECT_ROOT)."
    return 1
  fi

  local detected_version="legacy-$(date -u +%Y%m%dT%H%M%SZ)"
  if [[ -f "$PROJECT_ROOT/VERSION" ]]; then
    local file_version=""
    file_version="$(head -n1 "$PROJECT_ROOT/VERSION" | tr -d '\r' || true)"
    if [[ -n "$file_version" ]]; then
      detected_version="$file_version"
    fi
  fi

  local bootstrap_release="$RELEASES_DIR/$(sanitize_release_name "$detected_version")"
  log "Bootstrap da estrutura atomica: criando release base em $bootstrap_release"

  if [[ ! -d "$bootstrap_release" ]]; then
    mkdir -p "$bootstrap_release"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete \
        --exclude 'releases' \
        --exclude 'shared' \
        --exclude 'current' \
        --exclude 'previous' \
        "$BASE_DIR/" "$bootstrap_release/"
    else
      tar -C "$BASE_DIR" \
        --exclude './releases' \
        --exclude './shared' \
        --exclude './current' \
        --exclude './previous' \
        -cf - . | tar -C "$bootstrap_release" -xf -
    fi
  fi

  ln -sfn "$bootstrap_release" "$CURRENT_LINK"
  log "Bootstrap concluido. current -> $bootstrap_release"
  return 0
}

ensure_shared_env() {
  if [[ -f "$SHARED_DIR/.env" ]]; then
    return 0
  fi

  local candidates=(
    "$PROJECT_ROOT/apps/backend/.env"
    "$PROJECT_ROOT/.env"
    "$CURRENT_LINK/apps/backend/.env"
    "$CURRENT_LINK/.env"
  )

  local candidate=""
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      cp "$candidate" "$SHARED_DIR/.env"
      log "Arquivo shared/.env criado a partir de: $candidate"
      return 0
    fi
  done

  log_err "shared/.env nao encontrado e nenhum .env legado disponivel para migracao."
  return 1
}

ensure_shared_frontend_env() {
  if [[ -f "$SHARED_DIR/.env.frontend.local" ]]; then
    return 0
  fi

  local candidates=(
    "$PROJECT_ROOT/apps/frontend/.env.local"
    "$CURRENT_LINK/apps/frontend/.env.local"
  )

  local candidate=""
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      cp "$candidate" "$SHARED_DIR/.env.frontend.local"
      return 0
    fi
  done
  return 0
}

download_release_tarball() {
  local target_tag="$1"
  local release_dir="$2"
  local repo_web_url
  repo_web_url="$(normalize_repo_web_url "$GIT_REPO_URL")"

  if [[ ! "$repo_web_url" =~ ^https://github.com/.+/.+$ ]]; then
    return 1
  fi

  ensure_command curl "$EXIT_DOWNLOAD_FAILED"
  ensure_command tar "$EXIT_DOWNLOAD_FAILED"

  local tarball_url="${repo_web_url}/archive/refs/tags/${target_tag}.tar.gz"
  local tmp_dir=""
  local archive_file=""
  local extracted_dir=""
  tmp_dir="$(mktemp -d)"
  archive_file="${tmp_dir}/release.tar.gz"

  log "Baixando release tarball: ${tarball_url}"
  if [[ -n "$GIT_AUTH_HEADER" ]]; then
    curl -fsSL -H "$GIT_AUTH_HEADER" "$tarball_url" -o "$archive_file"
  else
    curl -fsSL "$tarball_url" -o "$archive_file"
  fi

  tar -xzf "$archive_file" -C "$tmp_dir"
  extracted_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d | head -n1)"
  if [[ -z "$extracted_dir" ]]; then
    log_err "Falha ao extrair tarball da release."
    rm -rf "$tmp_dir"
    return 1
  fi

  mkdir -p "$release_dir"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$extracted_dir/" "$release_dir/"
  else
    rm -rf "$release_dir"
    mkdir -p "$release_dir"
    cp -a "$extracted_dir/." "$release_dir/"
  fi

  rm -rf "$tmp_dir"
  return 0
}

download_release_git_clone() {
  local target_tag="$1"
  local release_dir="$2"
  ensure_command git "$EXIT_DOWNLOAD_FAILED"

  if [[ -z "$GIT_REPO_URL" ]]; then
    log_err "GIT_REPO_URL nao informado e tarball indisponivel."
    return 1
  fi

  log "Tarball indisponivel. Fazendo git clone da tag ${target_tag}..."
  if [[ -n "$GIT_AUTH_HEADER" ]]; then
    git -c "http.extraHeader=${GIT_AUTH_HEADER}" clone --depth 1 --branch "$target_tag" "$GIT_REPO_URL" "$release_dir"
  else
    git clone --depth 1 --branch "$target_tag" "$GIT_REPO_URL" "$release_dir"
  fi
}

ensure_release_code() {
  local target_tag="$1"
  local release_dir="$2"

  if [[ -d "$release_dir" ]]; then
    if validate_release_dir "$release_dir"; then
      log "Release ${target_tag} ja existe em ${release_dir}. Reutilizando."
      return 0
    fi
    log_err "Release existente em ${release_dir} esta inconsistente."
    return 1
  fi

  if [[ -n "$GIT_REPO_URL" ]] && download_release_tarball "$target_tag" "$release_dir"; then
    :
  else
    download_release_git_clone "$target_tag" "$release_dir"
  fi

  if ! validate_release_dir "$release_dir"; then
    log_err "Release ${target_tag} baixada sem estrutura valida."
    return 1
  fi
  return 0
}

resolve_build_metadata() {
  local release_dir="$1"
  RESOLVED_BUILD_TIME="$(now_iso)"
  RESOLVED_APP_VERSION="${APP_VERSION:-$TARGET_TAG}"
  RESOLVED_GIT_SHA="${BUILD_COMMIT_SHA:-unknown}"
  RESOLVED_BRANCH="${BUILD_BRANCH:-}"

  if [[ -f "$release_dir/VERSION" ]]; then
    local existing_version=""
    existing_version="$(head -n1 "$release_dir/VERSION" | tr -d '\r' || true)"
    if [[ -n "$existing_version" ]] && [[ -z "${APP_VERSION:-}" ]]; then
      RESOLVED_APP_VERSION="$existing_version"
    fi
  fi

  if [[ -d "$release_dir/.git" ]] && command -v git >/dev/null 2>&1; then
    local full_sha=""
    local branch_name=""
    full_sha="$(git -C "$release_dir" rev-parse HEAD 2>/dev/null || true)"
    branch_name="$(git -C "$release_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    if [[ -n "$full_sha" ]]; then
      RESOLVED_GIT_SHA="$full_sha"
    fi
    if [[ -n "$branch_name" ]]; then
      RESOLVED_BRANCH="$branch_name"
    fi
  fi
}

write_build_metadata_files() {
  local target_dir="$1"
  local version_json=""
  local sha_json=""
  local build_json=""
  local branch_json=""
  version_json="$(json_escape "$RESOLVED_APP_VERSION")"
  sha_json="$(json_escape "$RESOLVED_GIT_SHA")"
  build_json="$(json_escape "$RESOLVED_BUILD_TIME")"
  branch_json="$(json_escape "$RESOLVED_BRANCH")"

  printf '%s\n' "${RESOLVED_APP_VERSION:-unknown}" > "$target_dir/VERSION"
  if [[ -n "$RESOLVED_BRANCH" ]]; then
    printf '{\n  "version": "%s",\n  "commitSha": "%s",\n  "buildDate": "%s",\n  "branch": "%s"\n}\n' \
      "$version_json" "$sha_json" "$build_json" "$branch_json" > "$target_dir/BUILD_INFO.json"
  else
    printf '{\n  "version": "%s",\n  "commitSha": "%s",\n  "buildDate": "%s"\n}\n' \
      "$version_json" "$sha_json" "$build_json" > "$target_dir/BUILD_INFO.json"
  fi
}

link_shared_into_release() {
  local release_dir="$1"
  ln -sfn "$SHARED_DIR/.env" "$release_dir/.env"
  mkdir -p "$release_dir/apps/backend"
  ln -sfn "$SHARED_DIR/.env" "$release_dir/apps/backend/.env"
  mkdir -p "$release_dir/apps/frontend"
  if [[ -f "$SHARED_DIR/.env.frontend.local" ]]; then
    ln -sfn "$SHARED_DIR/.env.frontend.local" "$release_dir/apps/frontend/.env.local"
  fi
  ln -sfn "$SHARED_DIR/uploads" "$release_dir/uploads"
  ln -sfn "$SHARED_DIR/backups" "$release_dir/backups"
}

discover_pm2_name() {
  local token="$1"
  pm2 jlist 2>/dev/null | grep -oE "\"name\":\"[^\"]*${token}[^\"]*\"" | head -n1 | cut -d'"' -f4 || true
}

restart_pm2_processes() {
  local target_root="$1"
  local backend_name="${PM2_BACKEND_NAME:-$BACKEND_PROC}"
  local frontend_name="${PM2_FRONTEND_NAME:-$FRONTEND_PROC}"

  if [[ -z "$backend_name" ]]; then
    backend_name="multitenant-backend"
  fi
  if [[ -z "$frontend_name" ]]; then
    frontend_name="multitenant-frontend"
  fi

  log "Reiniciando PM2 com codigo em ${target_root}"
  pm2 delete "$backend_name" >/dev/null 2>&1 || true
  pm2 delete "$frontend_name" >/dev/null 2>&1 || true

  pm2 start dist/main.js --name "$backend_name" --cwd "$target_root/apps/backend" --update-env
  pm2 start "node .next/standalone/apps/frontend/server.js" --name "$frontend_name" --cwd "$target_root/apps/frontend" --update-env
  pm2 save

  BACKEND_PROC="$backend_name"
  FRONTEND_PROC="$frontend_name"
}

load_runtime_env_from_shared() {
  if [[ ! -f "$SHARED_DIR/.env" ]]; then
    export UPLOADS_DIR="${UPLOADS_DIR:-$SHARED_DIR/uploads}"
    export BACKUP_DIR="${BACKUP_DIR:-$SHARED_DIR/backups}"
    export LOGOS_UPLOAD_DIR="${LOGOS_UPLOAD_DIR:-${UPLOADS_DIR}/logos}"
    return 0
  fi

  export UPLOADS_DIR="${UPLOADS_DIR:-$SHARED_DIR/uploads}"
  export BACKUP_DIR="${BACKUP_DIR:-$SHARED_DIR/backups}"

  set -a
  # shellcheck disable=SC1090
  source "$SHARED_DIR/.env"
  set +a

  if [[ -z "${UPLOADS_DIR:-}" ]]; then
    UPLOADS_DIR="$SHARED_DIR/uploads"
  fi
  if [[ -z "${BACKUP_DIR:-}" ]]; then
    BACKUP_DIR="$SHARED_DIR/backups"
  fi
  if [[ -z "${LOGOS_UPLOAD_DIR:-}" ]] || [[ "${LOGOS_UPLOAD_DIR}" == "/logos" ]]; then
    LOGOS_UPLOAD_DIR="${UPLOADS_DIR}/logos"
  fi

  export UPLOADS_DIR BACKUP_DIR LOGOS_UPLOAD_DIR
}

wait_for_http_ok() {
  local url="$1"
  local timeout="$2"
  local label="$3"
  local started_at=0
  local now=0
  started_at="$(date +%s)"

  while true; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      log "${label} OK: ${url}"
      return 0
    fi

    now="$(date +%s)"
    if (( now - started_at >= timeout )); then
      log_err "Timeout no healthcheck de ${label}: ${url}"
      return 1
    fi
    sleep "$HEALTH_INTERVAL"
  done
}

run_healthchecks() {
  load_runtime_env_from_shared
  local backend_port="${PORT:-4000}"
  local frontend_port="${FRONTEND_PORT:-5000}"
  local backend_url="${BACKEND_HEALTH_URL:-http://127.0.0.1:${backend_port}/api/health}"
  local frontend_url="${FRONTEND_HEALTH_URL:-http://127.0.0.1:${frontend_port}/}"

  wait_for_http_ok "$backend_url" "$HEALTH_TIMEOUT" "backend"
  wait_for_http_ok "$frontend_url" "$HEALTH_TIMEOUT" "frontend"
}

prepare_release_build() {
  local release_dir="$1"
  log "Preparando release (deps/build/frontend/prisma-generate): $release_dir"

  (
    cd "$release_dir"
    pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
    pnpm --filter backend build

    (
      cd apps/backend
      pnpm exec prisma generate
      pnpm exec tsc prisma/seed.ts --outDir dist --skipLibCheck --module commonjs --target ES2021 --esModuleInterop --resolveJsonModule
    )

    pnpm --filter frontend build
  )
}

run_release_migrations() {
  local release_dir="$1"
  log "Executando migrations com maintenance ativo: $release_dir"

  (
    cd "$release_dir/apps/backend"
    set -a
    # shellcheck disable=SC1091
    source ./.env
    set +a
    pnpm exec prisma migrate deploy --schema prisma/schema.prisma
    node dist/prisma/seed.js deploy
  )
}

create_pre_swap_backup() {
  local from_version="$1"
  local to_version="$2"
  ensure_command tar "$EXIT_BACKUP_FAILED"
  ensure_command pg_dump "$EXIT_BACKUP_FAILED"

  load_runtime_env_from_shared
  if [[ -z "${DATABASE_URL:-}" ]]; then
    log_err "DATABASE_URL ausente no shared/.env. Backup obrigatorio falhou."
    return 1
  fi

  local stamp=""
  local from_safe=""
  local to_safe=""
  local backup_dir=""
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  from_safe="$(sanitize_release_name "$from_version")"
  to_safe="$(sanitize_release_name "$to_version")"
  backup_dir="$SHARED_DIR/backups/${stamp}_${from_safe}_to_${to_safe}"
  mkdir -p "$backup_dir"

  log "Gerando backup pre-swap em $backup_dir"
  cp "$SHARED_DIR/.env" "$backup_dir/.env.snapshot"
  tar -C "$SHARED_DIR" -czf "$backup_dir/uploads.tar.gz" uploads
  pg_dump --format=custom --no-owner --no-privileges --file "$backup_dir/database.dump" "$DATABASE_URL"

  printf '{\n  "fromVersion": "%s",\n  "toVersion": "%s",\n  "createdAt": "%s",\n  "dbDumpPath": "%s",\n  "uploadsArchivePath": "%s",\n  "envSnapshotPath": "%s"\n}\n' \
    "$(json_escape "$from_version")" \
    "$(json_escape "$to_version")" \
    "$(now_iso)" \
    "$(json_escape "$backup_dir/database.dump")" \
    "$(json_escape "$backup_dir/uploads.tar.gz")" \
    "$(json_escape "$backup_dir/.env.snapshot")" > "$backup_dir/manifest.json"

  return 0
}

run_release_retention() {
  local retention_script="$SCRIPT_DIR/release-retention.sh"
  if [[ -f "$retention_script" ]]; then
    bash "$retention_script" --base-dir "$BASE_DIR" --keep "$RELEASES_TO_KEEP" || \
      log "Aviso: release-retention falhou; seguindo sem bloquear update."
  else
    log "Aviso: install/release-retention.sh nao encontrado; retencao ignorada."
  fi
}

rollback_after_failed_health() {
  local previous_target="$1"
  ROLLBACK_ATTEMPTED="true"
  ROLLBACK_REASON="healthcheck failed after swap"
  set_step "rollback" 95
  write_state_file

  if [[ -z "$previous_target" ]] || [[ ! -d "$previous_target" ]]; then
    log_err "Rollback automatico indisponivel (previous invalido)."
    ROLLBACK_COMPLETED="false"
    write_state_file
    return 1
  fi

  log "Healthcheck falhou. Aplicando rollback para $previous_target"
  ln -sfn "$previous_target" "$CURRENT_LINK"
  if ! restart_pm2_processes "$CURRENT_LINK"; then
    log_err "Falha ao reiniciar PM2 durante rollback automatico."
    ROLLBACK_COMPLETED="false"
    write_state_file
    return 1
  fi

  if ! run_healthchecks; then
    log_err "Rollback aplicado, mas healthcheck ainda falhando."
    ROLLBACK_COMPLETED="false"
    write_state_file
    return 1
  fi

  ROLLBACK_COMPLETED="true"
  write_state_file
  log "ROLLBACK_COMPLETED: rollback automatico concluido"
  return 0
}

run_legacy_inplace() {
  ensure_command git "$EXIT_DOWNLOAD_FAILED"
  ensure_command pnpm "$EXIT_BUILD_FAILED"
  ensure_command pm2 "$EXIT_BUILD_FAILED"

  if [[ -z "$GIT_REPO_URL" ]]; then
    log_err "Modo --legacy-inplace requer GIT_REPO_URL."
    return 1
  fi

  set_step "legacy-inplace" 20
  log "Executando modo legado in-place para ${TARGET_TAG}"
  (
    cd "$PROJECT_ROOT"
    if [[ -n "$GIT_AUTH_HEADER" ]]; then
      git -c "http.extraHeader=${GIT_AUTH_HEADER}" fetch --tags --prune origin
    else
      git fetch --tags --prune origin
    fi
    git checkout "$TARGET_TAG"
    resolve_build_metadata "$PROJECT_ROOT"
    write_build_metadata_files "$PROJECT_ROOT"

    set_step "legacy-build" 50
    pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
    pnpm --filter backend build
    (
      cd apps/backend
      pnpm exec tsc prisma/seed.ts --outDir dist --skipLibCheck --module commonjs --target ES2021 --esModuleInterop --resolveJsonModule
    )
    pnpm --filter frontend build

    set_step "legacy-migrate" 70
    (
      cd apps/backend
      pnpm exec prisma migrate deploy --schema prisma/schema.prisma
      node dist/prisma/seed.js deploy
    )
  )

  BACKEND_PROC="$(discover_pm2_name backend)"
  FRONTEND_PROC="$(discover_pm2_name frontend)"
  set_step "legacy-restart" 90
  restart_pm2_processes "$PROJECT_ROOT"
  return 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tag)
        TARGET_TAG="$2"
        shift 2
        ;;
      --base-dir)
        APP_BASE_DIR="$2"
        shift 2
        ;;
      --legacy-inplace)
        LEGACY_INPLACE="true"
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        log_err "Opcao invalida: $1"
        usage
        exit 1
        ;;
    esac
  done
}

on_exit() {
  local exit_code="$1"
  local had_lock="$LOCK_ACQUIRED"

  if [[ "$LOCK_ACQUIRED" == "true" ]]; then
    release_lock
  fi

  if [[ "$exit_code" -ne 0 ]] && [[ "$had_lock" == "true" ]]; then
    ensure_maintenance_on_failure "Update crashed; intervention required. ${STATE_LAST_ERROR:-Unexpected failure during update.}"
  fi

  if [[ "$STATE_INITIALIZED" == "true" ]]; then
    STATE_LOCK="false"
    if [[ "$exit_code" -ne 0 ]] && [[ "$STATE_FINALIZED" != "true" ]] && [[ "$had_lock" == "true" ]]; then
      STATE_STATUS="failed"
      STATE_FINISHED_AT="$(now_iso)"
      STATE_LAST_ERROR="${STATE_LAST_ERROR:-Unexpected update termination}"
      write_state_file
    else
      write_state_file
    fi
  fi
}

main() {
  parse_args "$@"
  resolve_base_dir
  prepare_base_layout
  initialize_logging_and_state

  trap 'on_exit $?' EXIT

  ensure_command flock "$EXIT_BUILD_FAILED"
  ensure_command curl "$EXIT_BUILD_FAILED"
  ensure_command pnpm "$EXIT_BUILD_FAILED"
  ensure_command pm2 "$EXIT_BUILD_FAILED"

  set_step "lock" 2
  acquire_lock
  start_state
  set_step "lock" 2

  log "STEP 1/12 - Atualizacao atomica iniciada (tag=${TARGET_TAG}, base=${BASE_DIR})"

  if [[ "$LEGACY_INPLACE" == "true" ]]; then
    if ! run_legacy_inplace; then
      fail_and_exit "$EXIT_BUILD_FAILED" "Falha no modo legacy-inplace."
    fi
    finish_success
    log "Atualizacao legacy concluida com sucesso."
    exit "$EXIT_SUCCESS"
  fi

  set_step "bootstrap" 5
  if ! bootstrap_legacy_layout_if_needed; then
    fail_and_exit "$EXIT_DOWNLOAD_FAILED" "Falha ao preparar layout de releases/current/shared."
  fi

  set_step "shared-env" 10
  if ! ensure_shared_env; then
    fail_and_exit "$EXIT_BUILD_FAILED" "Falha ao preparar shared/.env."
  fi
  if ! ensure_required_security_secrets "$SHARED_DIR/.env"; then
    fail_and_exit "$EXIT_BUILD_FAILED" "Segredos obrigatorios invalidos em shared/.env."
  fi
  ensure_shared_frontend_env

  export APP_BASE_DIR="$BASE_DIR"
  export UPLOADS_DIR="$SHARED_DIR/uploads"
  export BACKUP_DIR="$SHARED_DIR/backups"
  export LOGOS_UPLOAD_DIR="$SHARED_DIR/uploads/logos"
  update_env_file "APP_BASE_DIR" "$BASE_DIR" "$SHARED_DIR/.env"
  update_env_file "UPLOADS_DIR" "$SHARED_DIR/uploads" "$SHARED_DIR/.env"
  update_env_file "BACKUP_DIR" "$SHARED_DIR/backups" "$SHARED_DIR/.env"
  update_env_file "LOGOS_UPLOAD_DIR" "$SHARED_DIR/uploads/logos" "$SHARED_DIR/.env"

  local target_release_name=""
  local release_dir=""
  target_release_name="$(sanitize_release_name "$TARGET_TAG")"
  release_dir="$RELEASES_DIR/$target_release_name"

  log "STEP 2/12 - Preparando release em $release_dir"
  set_step "prepare-release" 20
  if ! ensure_release_code "$TARGET_TAG" "$release_dir"; then
    fail_and_exit "$EXIT_DOWNLOAD_FAILED" "Falha ao obter codigo da release ${TARGET_TAG}."
  fi
  resolve_build_metadata "$release_dir"
  write_build_metadata_files "$release_dir"
  link_shared_into_release "$release_dir"

  STATE_TO_VERSION="$RESOLVED_APP_VERSION"
  write_state_file

  log "STEP 3/12 - Build da release alvo (sem downtime)"
  set_step "build" 45
  if ! prepare_release_build "$release_dir"; then
    fail_and_exit "$EXIT_BUILD_FAILED" "Falha na etapa de build da release."
  fi

  local current_target=""
  local from_version="unknown"
  current_target="$(get_link_target "$CURRENT_LINK")"
  if [[ -n "$current_target" ]] && [[ -f "$current_target/VERSION" ]]; then
    from_version="$(head -n1 "$current_target/VERSION" | tr -d '\r' || echo unknown)"
  elif [[ -n "$current_target" ]]; then
    from_version="$(basename "$current_target")"
  fi
  STATE_FROM_VERSION="$from_version"
  write_state_file

  local to_version="$RESOLVED_APP_VERSION"
  if [[ -z "$to_version" ]]; then
    to_version="$TARGET_TAG"
  fi
  STATE_TO_VERSION="$to_version"
  write_state_file

  log "STEP 4/12 - Backup obrigatorio pre-swap"
  set_step "backup" 58
  if ! create_pre_swap_backup "$from_version" "$to_version"; then
    fail_and_exit "$EXIT_BACKUP_FAILED" "Falha ao gerar backup pre-swap."
  fi

  log "STEP 5/12 - Ativando maintenance mode"
  set_step "maintenance_on" 62
  enable_maintenance_mode "Updating from ${from_version} to ${to_version}" "$MAINTENANCE_ETA_SECONDS"

  log "STEP 6/12 - Executando migrations com downtime controlado"
  set_step "migrations" 68
  if ! run_release_migrations "$release_dir"; then
    fail_and_exit "$EXIT_BUILD_FAILED" "Falha na etapa de migrations/seed."
  fi

  BACKEND_PROC="$(discover_pm2_name backend)"
  FRONTEND_PROC="$(discover_pm2_name frontend)"

  local previous_target=""
  previous_target="$current_target"
  if [[ -n "$current_target" ]]; then
    ln -sfn "$current_target" "$PREVIOUS_LINK"
  fi

  log "STEP 7/12 - Swap atomico de symlink current"
  set_step "swap" 75
  ln -sfn "$release_dir" "$CURRENT_LINK"

  log "STEP 8/12 - Reiniciando servicos PM2"
  set_step "restart-services" 82
  if ! restart_pm2_processes "$CURRENT_LINK"; then
    fail_and_exit "$EXIT_BUILD_FAILED" "Falha ao reiniciar servicos PM2."
  fi

  log "STEP 9/12 - Executando healthchecks"
  set_step "healthcheck" 90
  if ! run_healthchecks; then
    if rollback_after_failed_health "$previous_target"; then
      finish_rolled_back "Healthcheck falhou apos swap. Rollback automatico aplicado."
      exit "$EXIT_HEALTH_ROLLBACK_OK"
    fi
    finish_failed "$EXIT_HEALTH_ROLLBACK_FAILED" "Healthcheck falhou e rollback automatico nao concluiu."
    exit "$EXIT_HEALTH_ROLLBACK_FAILED"
  fi

  log "STEP 10/12 - Desativando maintenance mode"
  set_step "maintenance_off" 93
  disable_maintenance_mode "Update concluido com sucesso para ${to_version}"

  log "STEP 11/12 - Executando retencao de releases"
  set_step "retention" 95
  run_release_retention

  set_step "finalizing" 99
  finish_success
  log "STEP 12/12 - Versao ativa: ${to_version} | current -> $(get_link_target "$CURRENT_LINK")"
  log "Update atomico concluido com sucesso"
  exit "$EXIT_SUCCESS"
}

main "$@"
