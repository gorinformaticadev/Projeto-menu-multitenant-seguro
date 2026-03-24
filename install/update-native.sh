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
UPDATE_CHANNEL="${UPDATE_CHANNEL:-release}"
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

bootstrap_atomic_layout() {
  if [[ -L "$CURRENT_LINK" ]]; then
    return 0
  fi

  local detected_version="unknown"
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
  local channel="${3:-release}"
  local repo_web_url
  repo_web_url="$(normalize_repo_web_url "$GIT_REPO_URL")"

  if [[ ! "$repo_web_url" =~ ^https://github.com/.+/.+$ ]]; then
    log_err "URL do repositório inválida: $GIT_REPO_URL"
    return 1
  fi

  ensure_command curl "$EXIT_DOWNLOAD_FAILED"
  ensure_command tar "$EXIT_DOWNLOAD_FAILED"

  local tarball_url=""
  if [[ "$channel" == "release" ]]; then
    # Canal release: tenta baixar o artefato formal da release
    tarball_url="${repo_web_url}/releases/download/${target_tag}/${target_tag}.tar.gz"
  else
    # Canal tag: baixa o código-fonte compactado
    tarball_url="${repo_web_url}/archive/refs/tags/${target_tag}.tar.gz"
  fi

  local tmp_dir=""
  local archive_file=""
  local extracted_dir=""
  tmp_dir="$(mktemp -d)"
  archive_file="${tmp_dir}/release.tar.gz"

  log "Baixando release tarball (channel=$channel): ${tarball_url}"
  
  local curl_opts=(-fsSL --connect-timeout 30 --max-time 300 -A "Ticketz-Updater/1.0")
  if [[ -n "$GIT_AUTH_HEADER" ]]; then
    # O GIT_AUTH_HEADER pode vir como 'http.extraHeader=AUTHORIZATION: Bearer <TOKEN>'
    local auth_value="${GIT_AUTH_HEADER#http.extraHeader=}"
    curl_opts+=(-H "$auth_value")
    log "Usando autenticação para download."
  fi

  if ! curl "${curl_opts[@]}" "$tarball_url" -o "$archive_file"; then
    log_err "Falha ao baixar tarball da URL: ${tarball_url}"
    rm -rf "$tmp_dir"
    return 1
  fi

  if ! tar -xzf "$archive_file" -C "$tmp_dir"; then
    log_err "Falha ao extrair tarball da release."
    rm -rf "$tmp_dir"
    return 1
  fi

  extracted_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d | head -n1)"
  if [[ -z "$extracted_dir" ]]; then
    log_err "Pasta extraída não encontrada no tarball."
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
    log_err "GIT_REPO_URL nao informado."
    return 1
  fi

  log "Iniciando git clone da tag ${target_tag}..."
  local git_opts=("--depth" "1" "--branch" "$target_tag")
  
  if [[ -n "$GIT_AUTH_HEADER" ]]; then
    # GIT_AUTH_HEADER esperado: http.extraHeader=AUTHORIZATION: Bearer <TOKEN>
    git -c "${GIT_AUTH_HEADER}" clone "${git_opts[@]}" "$GIT_REPO_URL" "$release_dir"
  else
    git clone "${git_opts[@]}" "$GIT_REPO_URL" "$release_dir"
  fi
}

validate_release_dir() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then return 1; fi
  # Validação básica de estrutura
  if [[ ! -d "$dir/apps/backend" ]] && [[ ! -f "$dir/package.json" ]]; then
    return 1
  fi
  return 0
}

ensure_release_code() {
  local target_tag="$1"
  local release_dir="$2"

  if [[ -d "$release_dir" ]]; then
    if validate_release_dir "$release_dir"; then
      log "Release ${target_tag} ja existe em ${release_dir}. Reutilizando."
      return 0
    fi
    log_err "Release existente em ${release_dir} esta inconsistente. Removendo..."
    rm -rf "$release_dir"
  fi

  log "Iniciando obtenção do código via canal: $UPDATE_CHANNEL"

  if [[ "$UPDATE_CHANNEL" == "release" ]]; then
    if ! download_release_tarball "$target_tag" "$release_dir" "release"; then
      fail_and_exit "$EXIT_DOWNLOAD_FAILED" "Falha ao baixar release formal (canal release). Verifique se a release existe no GitHub."
    fi
  else
    # Canal tag: tenta tarball primeiro, depois git clone
    if download_release_tarball "$target_tag" "$release_dir" "tag"; then
      log "Download via tarball concluído."
    else
      log "Tarball indisponível ou falhou. Tentando git clone..."
      if ! download_release_git_clone "$target_tag" "$release_dir"; then
        fail_and_exit "$EXIT_DOWNLOAD_FAILED" "Falha ao obter código via tag (tarball e git clone falharam)."
      fi
    fi
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
  PORT=5000 HOSTNAME=0.0.0.0 pm2 start "node .next/standalone/apps/frontend/server.js" --name "$frontend_name" --cwd "$target_root/apps/frontend" --update-env
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

  # shellcheck disable=SC1091
  source "$SHARED_DIR/.env"
  export UPLOADS_DIR="${UPLOADS_DIR:-$SHARED_DIR/uploads}"
  export BACKUP_DIR="${BACKUP_DIR:-$SHARED_DIR/backups}"
  export LOGOS_UPLOAD_DIR="${LOGOS_UPLOAD_DIR:-${UPLOADS_DIR}/logos}"
}

healthcheck_http() {
  local port="$1"
  local path="${2:-/health}"
  local timeout="${3:-30}"
  local start_ts now_ts elapsed
  start_ts="$(date +%s)"

  while true; do
    if curl -fs "http://localhost:${port}${path}" >/dev/null 2>&1; then
      return 0
    fi
    now_ts="$(date +%s)"
    elapsed=$((now_ts - start_ts))
    if (( elapsed >= timeout )); then
      return 1
    fi
    sleep 2
  done
}

run_seed_deploy() {
  local backend_dir="$1/apps/backend"
  log "Executando seed versionado (apenas pendentes)..."
  (
    cd "$backend_dir"
    # shellcheck disable=SC1091
    source ./.env
    node dist/prisma/seed.js deploy
  )
}

validate_backend_shared_storage() {
  local backend_dir="$1/apps/backend"
  local probe_file="$backend_dir/.update-shared-storage-probe.cjs"

  cat > "$probe_file" <<'EOF'
let Redis;
try {
  Redis = require(require.resolve('ioredis', { paths: [process.cwd()] }));
} catch (error) {
  console.error('Dependencia ioredis nao encontrada no backend. Execute a instalacao de dependencias antes da validacao.');
  process.exit(1);
}

const host = process.env.REDIS_HOST || '127.0.0.1';
const port = Number(process.env.REDIS_PORT || 6379);
const username = process.env.REDIS_USERNAME || undefined;
const password = process.env.REDIS_PASSWORD || undefined;
const db = Number(process.env.REDIS_DB || 0);

const options = {
  host,
  port,
  db,
  connectTimeout: Number(process.env.RATE_LIMIT_REDIS_CONNECT_TIMEOUT || 1000),
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
};

if (username) options.username = username;
if (password) options.password = password;

const client = new Redis(options);

async function run() {
  if (client.status === 'wait') {
    await client.connect();
  }
  const pong = await client.ping();
  if (pong !== 'PONG') {
    throw new Error(`Redis ping inesperado: ${pong}`);
  }

  const key = `update:shared-storage:${Date.now()}`;
  await client.set(key, 'ok', 'EX', 20);
  const value = await client.get(key);
  if (value !== 'ok') {
    throw new Error('Falha no teste SET/GET do storage compartilhado');
  }
  await client.del(key);
  await client.quit();
}

run()
  .then(() => process.exit(0))
  .catch(async (error) => {
    try {
      await client.quit();
    } catch {}
    console.error(error?.message || error);
    process.exit(1);
  });
EOF

  if ! (
    cd "$backend_dir"
    # shellcheck disable=SC1091
    source ./.env
    node "$probe_file"
  ); then
    rm -f "$probe_file"
    return 1
  fi

  rm -f "$probe_file"
}

cleanup_old_releases() {
  log "Limpando releases antigas (mantendo ${RELEASES_TO_KEEP})..."
  ls -1dt "${RELEASES_DIR}"/* | tail -n +$((RELEASES_TO_KEEP + 1)) | xargs rm -rf || true
}

# =============================================================================
# Main Execution Flow
# =============================================================================

resolve_base_dir
prepare_base_layout
initialize_logging_and_state
acquire_lock

trap 'release_lock' EXIT

start_state
bootstrap_atomic_layout

set_step "precheck" 5
ensure_command pm2 "$EXIT_BUILD_FAILED"
ensure_shared_env || fail_and_exit "$EXIT_BUILD_FAILED" "Falha ao garantir shared/.env"
ensure_shared_frontend_env

load_runtime_env_from_shared

set_step "prepare" 10
NEW_RELEASE_DIR="${RELEASES_DIR}/$(sanitize_release_name "$TARGET_TAG")"

set_step "download" 20
ensure_release_code "$TARGET_TAG" "$NEW_RELEASE_DIR"
link_shared_into_release "$NEW_RELEASE_DIR"

set_step "build_dependencies" 40
log "Instalando dependencias..."
cd "$NEW_RELEASE_DIR"
ensure_command pnpm "$EXIT_BUILD_FAILED"
pnpm install --frozen-lockfile || fail_and_exit "$EXIT_BUILD_FAILED" "Falha ao instalar dependencias"

set_step "build_prisma_client" 44
log "Gerando cliente Prisma do backend..."
pnpm --filter backend exec prisma generate || fail_and_exit "$EXIT_BUILD_FAILED" "Falha ao gerar cliente Prisma do backend"

set_step "build_backend" 48
log "Compilando backend..."
pnpm --filter backend build || fail_and_exit "$EXIT_BUILD_FAILED" "Falha ao compilar backend"

set_step "build_frontend" 54
log "Compilando frontend..."
pnpm --filter frontend build || fail_and_exit "$EXIT_BUILD_FAILED" "Falha ao compilar frontend"

set_step "build_frontend_assets" 58
log "Organizando arquivos do frontend para execucao standalone..."
if [[ -d "$NEW_RELEASE_DIR/apps/frontend/public" ]]; then
  cp -r "$NEW_RELEASE_DIR/apps/frontend/public" "$NEW_RELEASE_DIR/apps/frontend/.next/standalone/apps/frontend/" || true
fi
mkdir -p "$NEW_RELEASE_DIR/apps/frontend/.next/standalone/apps/frontend/.next/static"
if [[ -d "$NEW_RELEASE_DIR/apps/frontend/.next/static" ]]; then
  cp -r "$NEW_RELEASE_DIR/apps/frontend/.next/static/." "$NEW_RELEASE_DIR/apps/frontend/.next/standalone/apps/frontend/.next/static/" || true
fi
mkdir -p "$NEW_RELEASE_DIR/apps/frontend/.next/standalone/apps/frontend/.next/server"
if [[ -d "$NEW_RELEASE_DIR/apps/frontend/.next/server" ]]; then
  cp -r "$NEW_RELEASE_DIR/apps/frontend/.next/server/." "$NEW_RELEASE_DIR/apps/frontend/.next/standalone/apps/frontend/.next/server/" || true
fi

set_step "migrate" 60
log "Executando migrations..."
cd "$NEW_RELEASE_DIR/apps/backend"
pnpm prisma migrate deploy --schema prisma/schema.prisma || fail_and_exit "$EXIT_BUILD_FAILED" "Falha nas migrations"

set_step "seed" 70
run_seed_deploy "$NEW_RELEASE_DIR" || fail_and_exit "$EXIT_BUILD_FAILED" "Falha no seed versionado"

set_step "switch" 80
enable_maintenance_mode "Atualizando sistema para versao ${TARGET_TAG}"

CURRENT_TARGET="$(get_link_target "$CURRENT_LINK")"
if [[ -n "$CURRENT_TARGET" ]] && [[ "$CURRENT_TARGET" != "$NEW_RELEASE_DIR" ]]; then
  ln -sfn "$CURRENT_TARGET" "$PREVIOUS_LINK"
fi

resolve_build_metadata "$NEW_RELEASE_DIR"
write_build_metadata_files "$NEW_RELEASE_DIR"
ln -sfn "$NEW_RELEASE_DIR" "$CURRENT_LINK"

set_step "restart" 90
restart_pm2_processes "$NEW_RELEASE_DIR"

set_step "validate" 93
log "Validando storage compartilhado do backend..."
validate_backend_shared_storage "$NEW_RELEASE_DIR" || fail_and_exit "$EXIT_BUILD_FAILED" "Falha na validacao do storage compartilhado do backend"

set_step "healthcheck" 95
log "Validando integridade do sistema..."
if healthcheck_http 5000 "/api/health" "$HEALTH_TIMEOUT"; then
  log "Sistema saudavel."
else
  log_err "Healthcheck falhou. Iniciando rollback..."
  ROLLBACK_ATTEMPTED="true"
  PREV_TARGET="$(get_link_target "$PREVIOUS_LINK")"
  if [[ -n "$PREV_TARGET" ]] && [[ -d "$PREV_TARGET" ]]; then
    ln -sfn "$PREV_TARGET" "$CURRENT_LINK"
    restart_pm2_processes "$PREV_TARGET"
    ROLLBACK_COMPLETED="true"
    ROLLBACK_REASON="Healthcheck falhou apos update para ${TARGET_TAG}"
    finish_rolled_back "$ROLLBACK_REASON"
    ensure_maintenance_on_failure "Sistema em rollback devido a falha crítica."
    exit "$EXIT_HEALTH_ROLLBACK_OK"
  else
    ROLLBACK_COMPLETED="false"
    ROLLBACK_REASON="Healthcheck falhou e nao ha release anterior para rollback."
    fail_and_exit "$EXIT_HEALTH_ROLLBACK_FAILED" "$ROLLBACK_REASON"
  fi
fi

cleanup_old_releases
disable_maintenance_mode
finish_success
exit "$EXIT_SUCCESS"
