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
#   40 install dependencies failed
#   41 build failed
#   42 migrate failed
#   43 seed failed
#   44 package integrity failed
#   45 publish/symlink failed
#   46 pm2 start failed
#   47 post-deploy validation failed
#   50 post-deploy validation failed + rollback succeeded
#   60 post-deploy validation failed + rollback failed
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

EXIT_SUCCESS=0
EXIT_LOCK_HELD=10
EXIT_DOWNLOAD_FAILED=30
EXIT_INSTALL_FAILED=40
EXIT_BUILD_FAILED=41
EXIT_MIGRATE_FAILED=42
EXIT_SEED_FAILED=43
EXIT_PACKAGE_INTEGRITY_FAILED=44
EXIT_PUBLISH_FAILED=45
EXIT_PM2_FAILED=46
EXIT_POST_DEPLOY_VALIDATION_FAILED=47
EXIT_HEALTH_ROLLBACK_OK=50
EXIT_HEALTH_ROLLBACK_FAILED=60

BASE_DIR=""
RELEASES_DIR=""
SHARED_DIR=""
CURRENT_LINK=""
PREVIOUS_LINK=""
LOCK_FILE=""
LOCK_FD=99

STATE_FILE=""
UPDATE_LOG_FILE=""
MAINTENANCE_FILE=""
STATE_INITIALIZED="false"

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
STATE_ERROR_CODE=""
STATE_ERROR_CATEGORY=""
STATE_ERROR_STAGE=""
STATE_EXIT_CODE=""
STATE_USER_MESSAGE=""
STATE_TECHNICAL_MESSAGE=""
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
FRONTEND_STANDALONE_LAYOUT=""
FRONTEND_STANDALONE_ENTRY_REL=""
FRONTEND_STANDALONE_RUNTIME_DIR=""
FRONTEND_STANDALONE_BUILD_DIR=""
LAST_FRONTEND_ARTIFACT_ERROR=""
SEED_COMMAND_BIN=""
SEED_COMMAND_SOURCE=""
SEED_COMMAND_ARGS=()
LAST_SEED_RESOLUTION_ERROR=""
LAST_PM2_RUNTIME_ERROR=""
RELEASE_PREPARATION_ACTION=""
LAST_RELEASE_PREPARATION_ERROR=""

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
  --help                 Mostra ajuda
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tag)
        if [[ $# -lt 2 ]]; then
          log_err "A opcao --tag exige um valor."
          usage
          exit 1
        fi
        TARGET_TAG="$2"
        shift 2
        ;;
      --base-dir)
        if [[ $# -lt 2 ]]; then
          log_err "A opcao --base-dir exige um valor."
          usage
          exit 1
        fi
        APP_BASE_DIR="$2"
        shift 2
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

json_number_or_null() {
  local value="${1:-}"
  if [[ -z "$value" ]]; then
    echo "null"
  else
    echo "$value"
  fi
}

recent_failure_detail() {
  local fallback="$1"
  local lines="${2:-40}"
  local excerpt=""

  if [[ -f "$UPDATE_LOG_FILE" ]]; then
    excerpt="$(tail -n "$lines" "$UPDATE_LOG_FILE" 2>/dev/null | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
  fi

  if [[ -n "$excerpt" ]]; then
    printf '%s\n' "$excerpt"
  else
    printf '%s\n' "$fallback"
  fi
}

reset_error_state() {
  STATE_ERROR_CODE=""
  STATE_ERROR_CATEGORY=""
  STATE_ERROR_STAGE=""
  STATE_EXIT_CODE=""
  STATE_USER_MESSAGE=""
  STATE_TECHNICAL_MESSAGE=""
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
  "errorCode": $(json_or_null "$STATE_ERROR_CODE"),
  "errorCategory": $(json_or_null "$STATE_ERROR_CATEGORY"),
  "errorStage": $(json_or_null "$STATE_ERROR_STAGE"),
  "exitCode": $(json_number_or_null "$STATE_EXIT_CODE"),
  "userMessage": $(json_or_null "$STATE_USER_MESSAGE"),
  "technicalMessage": $(json_or_null "$STATE_TECHNICAL_MESSAGE"),
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
  reset_error_state
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
  reset_error_state
  set_step "completed" 100
  write_state_file
}

finish_failed() {
  local code="$1"
  local stage="${2:-$STATE_STEP}"
  local error_code="${3:-UPDATE_UNEXPECTED_ERROR}"
  local error_category="${4:-UPDATE_UNEXPECTED_ERROR}"
  local user_message="${5:-Falha durante a atualizacao.}"
  local technical_message="${6:-$user_message}"
  STATE_STATUS="failed"
  STATE_FINISHED_AT="$(now_iso)"
  STATE_PROGRESS=100
  STATE_LOCK="false"
  CURRENT_STEP="$stage"
  STATE_STEP="$stage"
  STATE_LAST_ERROR="$technical_message"
  STATE_ERROR_CODE="$error_code"
  STATE_ERROR_CATEGORY="$error_category"
  STATE_ERROR_STAGE="$stage"
  STATE_EXIT_CODE="$code"
  STATE_USER_MESSAGE="$user_message"
  STATE_TECHNICAL_MESSAGE="$technical_message"
  write_state_file
  log_err "${technical_message} (exit_code=${code}, error_code=${error_code}, stage=${stage})"
}

finish_rolled_back() {
  local message="$1"
  local stage="${2:-post_deploy_validation}"
  local error_code="${3:-UPDATE_POST_DEPLOY_VALIDATION_ERROR}"
  local error_category="${4:-UPDATE_POST_DEPLOY_VALIDATION_ERROR}"
  local user_message="${5:-A nova release falhou na validacao pos-deploy e o rollback automatico foi aplicado.}"
  local exit_code="${6:-$EXIT_HEALTH_ROLLBACK_OK}"
  STATE_STATUS="rolled_back"
  STATE_FINISHED_AT="$(now_iso)"
  STATE_PROGRESS=100
  STATE_LOCK="false"
  STATE_LAST_ERROR="$message"
  STATE_ERROR_CODE="$error_code"
  STATE_ERROR_CATEGORY="$error_category"
  STATE_ERROR_STAGE="$stage"
  STATE_EXIT_CODE="$exit_code"
  STATE_USER_MESSAGE="$user_message"
  STATE_TECHNICAL_MESSAGE="$message"
  set_step "rollback" 100
  write_state_file
}

fail_and_exit() {
  local code="$1"
  shift

  local stage=""
  local error_code=""
  local error_category=""
  local user_message=""
  local technical_message=""

  if [[ $# -le 1 ]]; then
    technical_message="${1:-Falha durante a atualizacao.}"
    stage="${STATE_STEP:-$CURRENT_STEP}"
    error_code="UPDATE_UNEXPECTED_ERROR"
    error_category="UPDATE_UNEXPECTED_ERROR"
    user_message="Falha durante a atualizacao."
  else
    stage="$1"
    error_code="$2"
    error_category="$3"
    user_message="$4"
    technical_message="${5:-$4}"
  fi

  if [[ "$STATE_INITIALIZED" == "true" ]]; then
    finish_failed "$code" "$stage" "$error_code" "$error_category" "$user_message" "$technical_message"
  else
    log_err "${technical_message} (exit_code=${code}, error_code=${error_code}, stage=${stage})"
  fi
  exit "$code"
}

ensure_command() {
  local cmd="$1"
  local code="${2:-$EXIT_BUILD_FAILED}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail_and_exit "$code" "$CURRENT_STEP" "UPDATE_RUNTIME_PREREQUISITE_ERROR" "UPDATE_RUNTIME_PREREQUISITE_ERROR" \
      "Dependencia obrigatoria do ambiente nao encontrada." "Comando obrigatorio nao encontrado: $cmd"
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

  STATE_LOCK="true"
  write_state_file
}

# shellcheck disable=SC2317
release_lock() {
  flock -u "$LOCK_FD" 2>/dev/null || true
  eval "exec ${LOCK_FD}>&-" 2>/dev/null || true
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

  local bootstrap_release=""
  bootstrap_release="$RELEASES_DIR/$(sanitize_release_name "$detected_version")"
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

reset_release_preparation_state() {
  RELEASE_PREPARATION_ACTION=""
  LAST_RELEASE_PREPARATION_ERROR=""
}

validate_release_dir() {
  local dir="$1"
  local checked_paths=(
    "$dir/package.json"
    "$dir/pnpm-workspace.yaml"
    "$dir/pnpm-lock.yaml"
    "$dir/apps/backend/package.json"
    "$dir/apps/frontend/package.json"
  )
  local missing_paths=()

  LAST_RELEASE_PREPARATION_ERROR=""

  if [[ ! -d "$dir" ]]; then
    LAST_RELEASE_PREPARATION_ERROR="Diretorio da release nao encontrado em $dir"
    return 1
  fi
  # Validação básica de estrutura
  for required_path in "${checked_paths[@]}"; do
    if [[ ! -e "$required_path" ]]; then
      missing_paths+=("$required_path")
    fi
  done

  if (( ${#missing_paths[@]} > 0 )); then
    LAST_RELEASE_PREPARATION_ERROR="Release sem estrutura minima valida. Arquivos ausentes: $(IFS=', '; echo "${missing_paths[*]}")"
    return 1
  fi
  return 0
}

ensure_release_code() {
  local target_tag="$1"
  local release_dir="$2"
  local current_target=""
  local previous_target=""

  reset_release_preparation_state
  current_target="$(get_link_target "$CURRENT_LINK")"
  previous_target="$(get_link_target "$PREVIOUS_LINK")"

  if [[ -d "$release_dir" ]]; then
    if [[ "$release_dir" == "$current_target" ]] || [[ "$release_dir" == "$previous_target" ]]; then
      LAST_RELEASE_PREPARATION_ERROR="Release ${release_dir} esta protegida por current/previous e nao pode ser recriada."
      log_err "$LAST_RELEASE_PREPARATION_ERROR"
      return 1
    fi

    if validate_release_dir "$release_dir"; then
      RELEASE_PREPARATION_ACTION="reused"
      log "Release ${target_tag} ja existe em ${release_dir} e sera reutilizada."
      return 0
    fi

    log "Release ${target_tag} ja existe em ${release_dir}, mas esta parcial ou invalida. Reconstruindo do zero."
    if ! rm -rf "$release_dir"; then
      LAST_RELEASE_PREPARATION_ERROR="Falha ao remover a release invalida em $release_dir"
      log_err "$LAST_RELEASE_PREPARATION_ERROR"
      return 1
    fi
    RELEASE_PREPARATION_ACTION="recreated"
  else
    RELEASE_PREPARATION_ACTION="created"
  fi

  log "Iniciando obtenção do código via canal: $UPDATE_CHANNEL"

  if [[ "$UPDATE_CHANNEL" == "release" ]]; then
    if ! download_release_tarball "$target_tag" "$release_dir" "release"; then
      fail_and_exit "$EXIT_DOWNLOAD_FAILED" "download" "UPDATE_DOWNLOAD_ERROR" "UPDATE_DOWNLOAD_ERROR" \
        "Falha ao baixar a release formal do repositÃ³rio." "Falha ao baixar release formal (canal release). Verifique se a release existe no GitHub."
    fi
  else
    # Canal tag: tenta tarball primeiro, depois git clone
    if download_release_tarball "$target_tag" "$release_dir" "tag"; then
      log "Download via tarball concluído."
    else
      log "Tarball indisponível ou falhou. Tentando git clone..."
      if ! download_release_git_clone "$target_tag" "$release_dir"; then
        fail_and_exit "$EXIT_DOWNLOAD_FAILED" "download" "UPDATE_DOWNLOAD_ERROR" "UPDATE_DOWNLOAD_ERROR" \
          "Falha ao baixar a release alvo." "Falha ao obter codigo via tag apos tentar tarball e git clone."
      fi
    fi
  fi

  if ! validate_release_dir "$release_dir"; then
    if [[ -z "$LAST_RELEASE_PREPARATION_ERROR" ]]; then
      LAST_RELEASE_PREPARATION_ERROR="Release ${target_tag} baixada sem estrutura minima valida."
    fi
    log_err "$LAST_RELEASE_PREPARATION_ERROR"
    return 1
  fi

  if [[ "$RELEASE_PREPARATION_ACTION" == "recreated" ]]; then
    log "Release ${target_tag} foi reconstruida do zero apos detectar estrutura invalida na tentativa anterior."
  else
    log "Release ${target_tag} foi preparada do zero."
  fi
  return 0
}

reset_release_build_outputs() {
  local release_dir="$1"
  rm -rf \
    "$release_dir/apps/backend/dist" \
    "$release_dir/apps/frontend/.next"
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

default_pm2_name_for_role() {
  local role="$1"
  local instance_name=""
  instance_name="$(basename "$BASE_DIR" | tr -cs '[:alnum:]._-' '-' | sed 's/^-*//; s/-*$//')"
  [[ -n "$instance_name" ]] || instance_name="multitenant"
  printf '%s-%s\n' "$instance_name" "$role"
}

resolve_pm2_process_names() {
  RESOLVED_PM2_BACKEND_NAME="${PM2_BACKEND_NAME:-$BACKEND_PROC}"
  RESOLVED_PM2_FRONTEND_NAME="${PM2_FRONTEND_NAME:-$FRONTEND_PROC}"

  if [[ -z "$RESOLVED_PM2_BACKEND_NAME" ]]; then
    RESOLVED_PM2_BACKEND_NAME="$(default_pm2_name_for_role backend)"
  fi
  if [[ -z "$RESOLVED_PM2_FRONTEND_NAME" ]]; then
    RESOLVED_PM2_FRONTEND_NAME="$(default_pm2_name_for_role frontend)"
  fi
}

collect_conflicting_pm2_names() {
  local base_dir="$1"
  local backend_name="$2"
  local frontend_name="$3"
  local pm2_output=""
  pm2_output="$(pm2 jlist 2>/dev/null || true)"

  PM2_JLIST="$pm2_output" node - "$base_dir" "$backend_name" "$frontend_name" <<'EOF'
const [, , baseDirArg, backendName, frontendName] = process.argv;
const raw = String(process.env.PM2_JLIST || '').trim();
const processes = raw ? JSON.parse(raw) : [];

function normalizePath(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase();
}

function isInside(candidate, baseDir) {
  return !!candidate && !!baseDir && (candidate === baseDir || candidate.startsWith(`${baseDir}/`));
}

function pickString(record, keys) {
  if (!record || typeof record !== 'object') return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function evidence(entry) {
  const env = entry?.pm2_env && typeof entry.pm2_env === 'object' ? entry.pm2_env : {};
  const rawArgs = entry?.args ?? env.args ?? [];
  const args = Array.isArray(rawArgs)
    ? rawArgs.map((value) => String(value))
    : typeof rawArgs === 'string' && rawArgs.trim()
      ? rawArgs.split(/\s+/).map((value) => value.trim()).filter(Boolean)
      : [];
  return {
    name: String(entry?.name || '').trim(),
    status: String(env.status || 'missing'),
    cwd: pickString(entry, ['pm_cwd', 'cwd']) || pickString(env, ['pm_cwd', 'cwd']) || '',
    execPath: pickString(entry, ['pm_exec_path', 'exec_path']) || pickString(env, ['pm_exec_path', 'exec_path']) || '',
    args,
  };
}

function resolveRole(process, baseDir) {
  const cwd = normalizePath(process.cwd);
  const execPath = normalizePath(process.execPath);
  const args = process.args.map(normalizePath);
  const name = String(process.name || '').toLowerCase();
  const belongsToBaseDir = isInside(cwd, baseDir) || isInside(execPath, baseDir);
  if (!belongsToBaseDir) return null;

  const backendSignal =
    name.includes('backend') ||
    cwd.includes('/apps/backend') ||
    execPath.includes('/apps/backend') ||
    execPath.endsWith('/dist/main.js') ||
    args.some((value) => value.includes('/apps/backend') || value.endsWith('/dist/main.js'));

  const frontendSignal =
    name.includes('frontend') ||
    cwd.includes('/apps/frontend') ||
    execPath.includes('/apps/frontend') ||
    execPath.endsWith('/scripts/start-standalone.mjs') ||
    execPath.includes('/.next/standalone/') ||
    args.some(
      (value) =>
        value.includes('/apps/frontend') ||
        value.endsWith('/scripts/start-standalone.mjs') ||
        value.includes('/.next/standalone/'),
    );

  if (backendSignal && !frontendSignal) return 'backend';
  if (frontendSignal && !backendSignal) return 'frontend';
  if (backendSignal) return 'backend';
  if (frontendSignal) return 'frontend';
  return null;
}

const baseDir = normalizePath(baseDirArg);
const conflicts = [];
for (const entry of processes) {
  const process = evidence(entry);
  if (process.status !== 'online') continue;
  const role = resolveRole(process, baseDir);
  if (role === 'backend' && process.name !== backendName) conflicts.push(process.name);
  if (role === 'frontend' && process.name !== frontendName) conflicts.push(process.name);
}

process.stdout.write(Array.from(new Set(conflicts.filter(Boolean))).join('\n'));
EOF
}

assert_pm2_release_state() {
  local base_dir="$1"
  local target_root="$2"
  local backend_name="$3"
  local frontend_name="$4"
  local pm2_output=""
  pm2_output="$(pm2 jlist 2>/dev/null || true)"

  PM2_JLIST="$pm2_output" node - "$base_dir" "$target_root" "$backend_name" "$frontend_name" <<'EOF'
const [, , baseDirArg, targetRootArg, backendName, frontendName] = process.argv;
const raw = String(process.env.PM2_JLIST || '').trim();
const processes = raw ? JSON.parse(raw) : [];

function normalizePath(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase();
}

function isInside(candidate, baseDir) {
  return !!candidate && !!baseDir && (candidate === baseDir || candidate.startsWith(`${baseDir}/`));
}

function pickString(record, keys) {
  if (!record || typeof record !== 'object') return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(record, keys) {
  if (!record || typeof record !== 'object') return null;
  for (const key of keys) {
    const parsed = Number(record[key]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function evidence(entry, expectedDir, fallbackName) {
  const env = entry?.pm2_env && typeof entry.pm2_env === 'object' ? entry.pm2_env : {};
  const rawArgs = entry?.args ?? env.args ?? [];
  const args = Array.isArray(rawArgs)
    ? rawArgs.map((value) => String(value))
    : typeof rawArgs === 'string' && rawArgs.trim()
      ? rawArgs.split(/\s+/).map((value) => value.trim()).filter(Boolean)
      : [];
  const cwd = pickString(entry, ['pm_cwd', 'cwd']) || pickString(env, ['pm_cwd', 'cwd']) || '';
  const execPath = pickString(entry, ['pm_exec_path', 'exec_path']) || pickString(env, ['pm_exec_path', 'exec_path']) || '';
  const normalizedExpectedDir = normalizePath(expectedDir);
  const pointsToExpectedRelease =
    (!!normalizedExpectedDir && normalizePath(cwd) === normalizedExpectedDir) ||
    isInside(normalizePath(execPath), normalizedExpectedDir) ||
    args.some((value) => isInside(normalizePath(value), normalizedExpectedDir));

  return {
    name: fallbackName || String(entry?.name || '').trim(),
    status: String(env.status || 'missing'),
    online: String(env.status || 'missing') === 'online',
    pmId: pickNumber(env, ['pm_id']) ?? pickNumber(entry, ['pm_id']) ?? -1,
    cwd,
    execPath,
    port: pickNumber(env.env, ['PORT', 'port']) ?? pickNumber(env, ['PORT', 'port']) ?? pickNumber(entry, ['PORT', 'port']),
    pointsToExpectedRelease: normalizedExpectedDir ? pointsToExpectedRelease : null,
  };
}

function resolveRole(process, baseDir) {
  const cwd = normalizePath(process.cwd);
  const execPath = normalizePath(process.execPath);
  const name = String(process.name || '').toLowerCase();
  const belongsToBaseDir = isInside(cwd, baseDir) || isInside(execPath, baseDir);
  if (!belongsToBaseDir) return null;

  const backendSignal =
    name.includes('backend') ||
    cwd.includes('/apps/backend') ||
    execPath.includes('/apps/backend') ||
    execPath.endsWith('/dist/main.js');

  const frontendSignal =
    name.includes('frontend') ||
    cwd.includes('/apps/frontend') ||
    execPath.includes('/apps/frontend') ||
    execPath.endsWith('/scripts/start-standalone.mjs') ||
    execPath.includes('/.next/standalone/');

  if (backendSignal && !frontendSignal) return 'backend';
  if (frontendSignal && !backendSignal) return 'frontend';
  if (backendSignal) return 'backend';
  if (frontendSignal) return 'frontend';
  return null;
}

const baseDir = normalizePath(baseDirArg);
const targetRoot = normalizePath(targetRootArg);
const backendExpectedDir = `${targetRoot}/apps/backend`;
const frontendExpectedDir = `${targetRoot}/apps/frontend`;

const byName = new Map();
const backendConflicts = [];
const frontendConflicts = [];

for (const entry of processes) {
  const processName = String(entry?.name || '').trim();
  if (processName) byName.set(processName, entry);

  const process = evidence(entry, null, processName);
  const role = resolveRole(process, baseDir);
  if (role === 'backend' && process.online && processName !== backendName) backendConflicts.push(processName);
  if (role === 'frontend' && process.online && processName !== frontendName) frontendConflicts.push(processName);
}

const backend = evidence(byName.get(backendName) || null, backendExpectedDir, backendName);
const frontend = evidence(byName.get(frontendName) || null, frontendExpectedDir, frontendName);

const summary = JSON.stringify({
  backend,
  frontend,
  backendConflicts: Array.from(new Set(backendConflicts)),
  frontendConflicts: Array.from(new Set(frontendConflicts)),
});

if (!backend.online || !frontend.online) {
  console.error(`Processos PM2 nao ficaram online apos o restart. ${summary}`);
  process.exit(1);
}

if (!backend.pointsToExpectedRelease || !frontend.pointsToExpectedRelease) {
  console.error(`Processos PM2 nao apontam para a release publicada. ${summary}`);
  process.exit(1);
}

if (backendConflicts.length > 0 || frontendConflicts.length > 0) {
  console.error(`Persistiram aliases PM2 conflitantes apos o restart. ${summary}`);
  process.exit(1);
}

console.log(summary);
EOF
}

restart_pm2_processes() {
  local target_root="$1"
  local backend_name=""
  local frontend_name=""
  local frontend_dir="$target_root/apps/frontend"
  local frontend_start_target=""
  local pm2_validation=""
  local conflicting_names=()
  local delete_candidates=()
  local process_name=""

  resolve_pm2_process_names
  backend_name="$RESOLVED_PM2_BACKEND_NAME"
  frontend_name="$RESOLVED_PM2_FRONTEND_NAME"
  mapfile -t conflicting_names < <(collect_conflicting_pm2_names "$BASE_DIR" "$backend_name" "$frontend_name" || true)
  delete_candidates=("$backend_name" "$frontend_name" "${conflicting_names[@]}")

  log "Reiniciando PM2 com codigo em ${target_root}"
  if (( ${#conflicting_names[@]} > 0 )); then
    log "Removendo aliases PM2 conflitantes: ${conflicting_names[*]}"
  fi
  for process_name in "${delete_candidates[@]}"; do
    [[ -n "$process_name" ]] || continue
    pm2 delete "$process_name" >/dev/null 2>&1 || true
  done

  pm2 start dist/main.js --name "$backend_name" --cwd "$target_root/apps/backend" --update-env || return 1
  frontend_start_target="$(resolve_frontend_start_target "$frontend_dir")" || return 1
  if [[ -n "${FRONTEND_STANDALONE_LAYOUT:-}" ]] && [[ -n "${FRONTEND_STANDALONE_ENTRY_REL:-}" ]]; then
    log "Entrypoint standalone do frontend detectado: ${FRONTEND_STANDALONE_LAYOUT} (${FRONTEND_STANDALONE_ENTRY_REL})"
  else
    log "Launcher canonico do frontend detectado: ${frontend_start_target}"
  fi
  load_frontend_runtime_env "$frontend_dir"
  PORT=5000 HOSTNAME=0.0.0.0 \
    pm2 start "node ${frontend_start_target}" --name "$frontend_name" --cwd "$frontend_dir" --update-env || return 1
  pm2 save

  if ! pm2_validation="$(assert_pm2_release_state "$BASE_DIR" "$target_root" "$backend_name" "$frontend_name" 2>&1)"; then
    LAST_PM2_RUNTIME_ERROR="$pm2_validation"
    log_err "$LAST_PM2_RUNTIME_ERROR"
    return 1
  fi
  LAST_PM2_RUNTIME_ERROR=""
  log "Estado do PM2 validado apos o restart: $pm2_validation"

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

wait_for_http_url() {
  local url="$1"
  local timeout="${2:-30}"
  local start_ts now_ts elapsed
  start_ts="$(date +%s)"

  while true; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
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

copy_directory_contents() {
  local source_dir="$1"
  local target_dir="$2"

  mkdir -p "$target_dir"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${source_dir}/" "${target_dir}/"
  else
    rm -rf "$target_dir"
    mkdir -p "$target_dir"
    cp -a "${source_dir}/." "${target_dir}/"
  fi
}

reset_frontend_standalone_resolution() {
  FRONTEND_STANDALONE_LAYOUT=""
  FRONTEND_STANDALONE_ENTRY_REL=""
  FRONTEND_STANDALONE_RUNTIME_DIR=""
  FRONTEND_STANDALONE_BUILD_DIR=""
}

record_frontend_artifact_error() {
  LAST_FRONTEND_ARTIFACT_ERROR="$1"
  log_err "$LAST_FRONTEND_ARTIFACT_ERROR"
}

resolve_frontend_standalone_layout() {
  local frontend_dir="$1"
  local resolver_script="$frontend_dir/scripts/start-standalone.mjs"
  local standalone_dir="$frontend_dir/.next/standalone"
  local resolved_layout=""

  reset_frontend_standalone_resolution
  LAST_FRONTEND_ARTIFACT_ERROR=""

  if [[ -f "$resolver_script" ]]; then
    if resolved_layout="$(node "$resolver_script" --print-layout 2>&1)"; then
      IFS='|' read -r FRONTEND_STANDALONE_LAYOUT FRONTEND_STANDALONE_ENTRY_REL FRONTEND_STANDALONE_RUNTIME_DIR FRONTEND_STANDALONE_BUILD_DIR <<< "$resolved_layout"
    else
      LAST_FRONTEND_ARTIFACT_ERROR="$(printf '%s' "$resolved_layout" | tail -n1)"
      log_err "$LAST_FRONTEND_ARTIFACT_ERROR"
      return 1
    fi
  elif [[ -f "$frontend_dir/.next/standalone/apps/frontend/server.js" ]]; then
    FRONTEND_STANDALONE_LAYOUT="monorepo-nested"
    FRONTEND_STANDALONE_ENTRY_REL=".next/standalone/apps/frontend/server.js"
    FRONTEND_STANDALONE_RUNTIME_DIR=".next/standalone/apps/frontend"
    FRONTEND_STANDALONE_BUILD_DIR=".next/standalone/apps/frontend/.next"
  elif [[ -f "$frontend_dir/.next/standalone/server.js" ]]; then
    FRONTEND_STANDALONE_LAYOUT="root"
    FRONTEND_STANDALONE_ENTRY_REL=".next/standalone/server.js"
    FRONTEND_STANDALONE_RUNTIME_DIR=".next/standalone"
    FRONTEND_STANDALONE_BUILD_DIR=".next/standalone/.next"
  else
    LAST_FRONTEND_ARTIFACT_ERROR="Nenhum entrypoint standalone do frontend foi encontrado. Caminhos verificados: $frontend_dir/.next/standalone/apps/frontend/server.js | $frontend_dir/.next/standalone/server.js"
    log_err "$LAST_FRONTEND_ARTIFACT_ERROR"
    if [[ -d "$standalone_dir" ]]; then
      log "Conteudo atual de $standalone_dir (maxdepth=3):"
      find "$standalone_dir" -maxdepth 3 \( -type d -o -type f \) | sed 's|^|  - |' | head -n 80 || true
    else
      log_err "Diretorio standalone do frontend nao encontrado em $standalone_dir"
    fi
    return 1
  fi

  if [[ -z "$FRONTEND_STANDALONE_ENTRY_REL" ]] || [[ -z "$FRONTEND_STANDALONE_RUNTIME_DIR" ]] || [[ -z "$FRONTEND_STANDALONE_BUILD_DIR" ]]; then
    LAST_FRONTEND_ARTIFACT_ERROR="Resolver do standalone retornou um layout incompleto para $frontend_dir."
    log_err "$LAST_FRONTEND_ARTIFACT_ERROR"
    return 1
  fi

  return 0
}

resolve_frontend_start_target() {
  local frontend_dir="$1"
  if [[ -f "$frontend_dir/scripts/start-standalone.mjs" ]]; then
    echo "scripts/start-standalone.mjs"
    return 0
  fi

  resolve_frontend_standalone_layout "$frontend_dir" || return 1
  echo "$FRONTEND_STANDALONE_ENTRY_REL"
}

load_frontend_runtime_env() {
  local frontend_dir="$1"
  if [[ ! -f "$frontend_dir/.env.local" ]]; then
    return 0
  fi

  set -a
  # shellcheck disable=SC1090
  source "$frontend_dir/.env.local"
  set +a
}

copy_frontend_runtime_assets() {
  local release_dir="$1"
  local frontend_dir="$release_dir/apps/frontend"
  local build_dir="$frontend_dir/.next"
  resolve_frontend_standalone_layout "$frontend_dir" || return 1

  if [[ -d "$frontend_dir/public" ]]; then
    if ! copy_directory_contents "$frontend_dir/public" "$frontend_dir/$FRONTEND_STANDALONE_RUNTIME_DIR/public"; then
      record_frontend_artifact_error "Falha ao copiar public para $frontend_dir/$FRONTEND_STANDALONE_RUNTIME_DIR/public"
      return 1
    fi
  fi

  if [[ -d "$build_dir/static" ]]; then
    if ! copy_directory_contents "$build_dir/static" "$frontend_dir/$FRONTEND_STANDALONE_RUNTIME_DIR/.next/static"; then
      record_frontend_artifact_error "Falha ao copiar .next/static para $frontend_dir/$FRONTEND_STANDALONE_RUNTIME_DIR/.next/static"
      return 1
    fi
  fi

  return 0
}

count_frontend_manifest_files() {
  local base_dir="$1"
  if [[ ! -d "$base_dir" ]]; then
    echo "0"
    return 0
  fi

  find "$base_dir" -type f \( -name '*client-reference-manifest*' -o -name '*server-reference-manifest*' \) | wc -l | tr -d ' '
}

reset_seed_resolution() {
  SEED_COMMAND_BIN=""
  SEED_COMMAND_SOURCE=""
  SEED_COMMAND_ARGS=()
  LAST_SEED_RESOLUTION_ERROR=""
}

has_seed_deploy_script() {
  local package_json_path="$1"
  [[ -f "$package_json_path" ]] || return 1

  node - "$package_json_path" <<'EOF'
const fs = require('node:fs');
const packageJsonPath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
process.exit(typeof pkg?.scripts?.['seed:deploy'] === 'string' && pkg.scripts['seed:deploy'].trim() ? 0 : 1);
EOF
}

resolve_seed_command() {
  local backend_dir="$1"
  reset_seed_resolution

  if has_seed_deploy_script "$backend_dir/package.json"; then
    SEED_COMMAND_BIN="pnpm"
    SEED_COMMAND_ARGS=(run seed:deploy)
    SEED_COMMAND_SOURCE="package_json_script"
    return 0
  fi

  if [[ -f "$backend_dir/prisma/seed.ts" ]]; then
    SEED_COMMAND_BIN="pnpm"
    SEED_COMMAND_ARGS=(exec tsx prisma/seed.ts deploy)
    SEED_COMMAND_SOURCE="prisma_seed_ts"
    return 0
  fi

  if [[ -f "$backend_dir/dist/prisma/seed.js" ]]; then
    SEED_COMMAND_BIN="node"
    SEED_COMMAND_ARGS=(dist/prisma/seed.js deploy)
    SEED_COMMAND_SOURCE="dist_seed_js_legacy"
    return 0
  fi

  LAST_SEED_RESOLUTION_ERROR="Nenhum comando de seed executavel foi encontrado em $backend_dir. Verificado: scripts.seed:deploy, prisma/seed.ts, dist/prisma/seed.js"
  return 1
}

validate_frontend_artifact_layout() {
  local release_dir="$1"
  local frontend_dir="$release_dir/apps/frontend"
  local build_dir="$frontend_dir/.next"
  resolve_frontend_standalone_layout "$frontend_dir" || return 1
  local standalone_runtime_dir="$frontend_dir/$FRONTEND_STANDALONE_RUNTIME_DIR"
  local standalone_build_dir="$frontend_dir/$FRONTEND_STANDALONE_BUILD_DIR"

  [[ -d "$build_dir" ]] || {
    record_frontend_artifact_error "Diretorio .next do frontend nao encontrado em $build_dir"
    return 1
  }
  [[ -f "$frontend_dir/$FRONTEND_STANDALONE_ENTRY_REL" ]] || {
    record_frontend_artifact_error "server.js do standalone nao encontrado em $frontend_dir/$FRONTEND_STANDALONE_ENTRY_REL"
    return 1
  }
  [[ -f "$build_dir/BUILD_ID" ]] || {
    record_frontend_artifact_error "BUILD_ID do frontend nao encontrado em $build_dir/BUILD_ID"
    return 1
  }
  [[ -f "$standalone_build_dir/BUILD_ID" ]] || {
    record_frontend_artifact_error "BUILD_ID do standalone nao encontrado em $standalone_build_dir/BUILD_ID"
    return 1
  }

  local source_build_id=""
  local standalone_build_id=""
  source_build_id="$(tr -d '\r' < "$build_dir/BUILD_ID" || true)"
  standalone_build_id="$(tr -d '\r' < "$standalone_build_dir/BUILD_ID" || true)"
  if [[ -z "$source_build_id" ]] || [[ "$source_build_id" != "$standalone_build_id" ]]; then
    record_frontend_artifact_error "BUILD_ID inconsistente entre build e standalone (fonte=${source_build_id:-<vazio>} standalone=${standalone_build_id:-<vazio>})."
    return 1
  fi

  if [[ -d "$build_dir/static" ]] && [[ ! -d "$standalone_build_dir/static" ]]; then
    record_frontend_artifact_error "Diretorio .next/static nao foi copiado para o standalone."
    return 1
  fi

  if [[ -d "$frontend_dir/public" ]] && [[ ! -d "$standalone_runtime_dir/public" ]]; then
    record_frontend_artifact_error "Diretorio public nao foi copiado para o standalone."
    return 1
  fi

  local source_manifest_count="0"
  local standalone_manifest_count="0"
  source_manifest_count="$(count_frontend_manifest_files "$build_dir/server")"
  standalone_manifest_count="$(count_frontend_manifest_files "$standalone_build_dir/server")"
  if (( source_manifest_count > 0 && standalone_manifest_count == 0 )); then
    record_frontend_artifact_error "Standalone nao contem manifests de referencia obrigatorios do frontend (fonte=${source_manifest_count}, standalone=${standalone_manifest_count})."
    return 1
  fi

  local source_500="$build_dir/server/pages/500.html"
  local standalone_500="$standalone_build_dir/server/pages/500.html"
  if [[ -f "$source_500" ]] && [[ ! -f "$standalone_500" ]]; then
    record_frontend_artifact_error "Artefato do standalone nao contem a pagina estatica 500 esperada."
    return 1
  fi

  return 0
}

extract_static_asset_path() {
  local html_file="$1"
  if [[ ! -f "$html_file" ]]; then
    echo ""
    return 0
  fi

  grep -oE '/_next/static/[^"'"'"'[:space:]]+' "$html_file" | head -n1 || true
}

check_frontend_http_endpoint() {
  local url="$1"
  local label="$2"
  local body_file="$3"

  if ! curl -fsS --max-time 10 "$url" -o "$body_file"; then
    log_err "Falha ao validar ${label}: ${url}"
    return 1
  fi

  if grep -qiE 'Invariant: The client reference manifest|Failed to load static file|Failed to find Server Action' "$body_file"; then
    log_err "Resposta de ${label} indica artefato inconsistente: ${url}"
    return 1
  fi

  return 0
}

validate_runtime_version_identity() {
  local backend_port="$1"
  local expected_version="$2"
  local tmp_dir="$3"
  local validation_output=""
  local system_version_file="$tmp_dir/system-version.json"
  local update_status_file="$tmp_dir/update-status.json"

  if ! curl -fsS --max-time 10 "http://127.0.0.1:${backend_port}/api/system/version" -o "$system_version_file"; then
    log_err "Falha ao consultar /api/system/version apos o deploy."
    return 1
  fi

  if ! curl -fsS --max-time 10 "http://127.0.0.1:${backend_port}/api/update/status" -o "$update_status_file"; then
    log_err "Falha ao consultar /api/update/status apos o deploy."
    return 1
  fi

  if ! validation_output="$(node - "$expected_version" "$system_version_file" "$update_status_file" <<'EOF'
const fs = require('node:fs');
const [, , expectedVersion, systemVersionFile, updateStatusFile] = process.argv;
const systemVersion = JSON.parse(fs.readFileSync(systemVersionFile, 'utf8'));
const updateStatus = JSON.parse(fs.readFileSync(updateStatusFile, 'utf8'));

function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '').replace(/\+.*$/, '');
}

function matchesTarget(target, ...candidates) {
  const normalizedTarget = normalizeVersion(target);
  return candidates
    .map(normalizeVersion)
    .filter(Boolean)
    .includes(normalizedTarget);
}

if (
  !matchesTarget(
    expectedVersion,
    systemVersion.installedVersionRaw,
    systemVersion.installedBaseTag,
    systemVersion.installedVersionNormalized,
    systemVersion.version,
  )
) {
  console.error(
    `Runtime backend ainda nao serve a release alvo. systemVersion=${JSON.stringify(systemVersion)} expected=${expectedVersion}`,
  );
  process.exit(1);
}

if (
  !matchesTarget(
    expectedVersion,
    updateStatus.installedVersionRaw,
    updateStatus.installedBaseTag,
    updateStatus.installedVersionNormalized,
    updateStatus.currentVersion,
  )
) {
  console.error(
    `Status do update ainda nao reflete a release publicada. updateStatus=${JSON.stringify(updateStatus)} expected=${expectedVersion}`,
  );
  process.exit(1);
}

if (updateStatus.updateAvailable === true && matchesTarget(expectedVersion, updateStatus.availableVersion)) {
  console.error(
    `A release publicada ainda aparece como atualizacao pendente. updateStatus=${JSON.stringify(updateStatus)}`,
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    systemVersion,
    updateStatus,
  }),
);
EOF
)"; then
    log_err "$validation_output"
    return 1
  fi

  log "Identidade do runtime validada: $validation_output"
}

smoke_test_frontend_release() {
  local release_dir="$1"
  local port="${2:-5100}"
  local frontend_dir="$release_dir/apps/frontend"
  local frontend_start_target=""
  local stdout_file="$frontend_dir/.next/frontend-smoke.out"
  local stderr_file="$frontend_dir/.next/frontend-smoke.err"
  local root_html="$frontend_dir/.next/frontend-smoke-root.html"
  local login_html="$frontend_dir/.next/frontend-smoke-login.html"
  local frontend_pid=""
  local status=0

  rm -f "$stdout_file" "$stderr_file" "$root_html" "$login_html"
  frontend_start_target="$(resolve_frontend_start_target "$frontend_dir")" || return 1

  (
    cd "$frontend_dir"
    load_frontend_runtime_env "$frontend_dir"
    PORT="$port" HOSTNAME="127.0.0.1" NODE_ENV=production \
      node "$frontend_start_target" > "$stdout_file" 2> "$stderr_file"
  ) &
  frontend_pid=$!

  cleanup_smoke_test() {
    if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" >/dev/null 2>&1; then
      kill "$frontend_pid" >/dev/null 2>&1 || true
      wait "$frontend_pid" >/dev/null 2>&1 || true
    fi
  }

  if ! healthcheck_http "$port" "/api/health" "$HEALTH_TIMEOUT"; then
    log_err "Frontend temporario nao respondeu ao healthcheck em http://127.0.0.1:${port}/api/health"
    status=1
  elif ! check_frontend_http_endpoint "http://127.0.0.1:${port}/" "rota /" "$root_html"; then
    status=1
  elif ! check_frontend_http_endpoint "http://127.0.0.1:${port}/login" "rota /login" "$login_html"; then
    status=1
  elif [[ -f "$frontend_dir/public/clear-cache.html" ]] && \
    ! check_frontend_http_endpoint "http://127.0.0.1:${port}/clear-cache.html" "asset publico clear-cache" "$frontend_dir/.next/frontend-smoke-clear-cache.html"; then
    status=1
  else
    local static_asset=""
    static_asset="$(extract_static_asset_path "$login_html")"
    if [[ -z "$static_asset" ]]; then
      static_asset="$(extract_static_asset_path "$root_html")"
    fi
    if [[ -z "$static_asset" ]]; then
      log_err "Nao foi possivel localizar nenhum asset em /_next/static durante o smoke test do frontend."
      status=1
    elif ! check_frontend_http_endpoint "http://127.0.0.1:${port}${static_asset}" "asset estatico ${static_asset}" "$frontend_dir/.next/frontend-smoke-static.bin"; then
      status=1
    fi
  fi

  cleanup_smoke_test
  return "$status"
}

validate_live_runtime() {
  local backend_port="${1:-4000}"
  local frontend_port="${2:-5000}"
  local expected_release_dir="${3:-$CURRENT_LINK}"
  local expected_version="${4:-$TARGET_TAG}"
  local tmp_dir=""
  local status=0
  local pm2_validation=""
  tmp_dir="$(mktemp -d)"

  cleanup_live_validation() {
    rm -rf "$tmp_dir"
  }

  if ! wait_for_http_url "http://127.0.0.1:${backend_port}/api/health" "$HEALTH_TIMEOUT"; then
    log_err "Backend nao respondeu ao healthcheck apos o deploy."
    status=1
  elif ! wait_for_http_url "http://127.0.0.1:${frontend_port}/api/health" "$HEALTH_TIMEOUT"; then
    log_err "Frontend nao respondeu ao healthcheck apos o deploy."
    status=1
  elif ! resolve_pm2_process_names; then
    log_err "Falha ao resolver os nomes PM2 esperados para validacao pos-deploy."
    status=1
  elif ! pm2_validation="$(assert_pm2_release_state "$BASE_DIR" "$expected_release_dir" "$RESOLVED_PM2_BACKEND_NAME" "$RESOLVED_PM2_FRONTEND_NAME" 2>&1)"; then
    log_err "$pm2_validation"
    status=1
  elif ! check_frontend_http_endpoint "http://127.0.0.1:${backend_port}/api/health" "healthcheck do backend" "$tmp_dir/backend-health.json"; then
    status=1
  elif ! check_frontend_http_endpoint "http://127.0.0.1:${frontend_port}/api/health" "healthcheck do frontend" "$tmp_dir/frontend-health.json"; then
    status=1
  elif ! check_frontend_http_endpoint "http://127.0.0.1:${frontend_port}/" "rota / em producao" "$tmp_dir/frontend-root.html"; then
    status=1
  elif ! check_frontend_http_endpoint "http://127.0.0.1:${frontend_port}/login" "rota /login em producao" "$tmp_dir/frontend-login.html"; then
    status=1
  else
    local static_asset=""
    static_asset="$(extract_static_asset_path "$tmp_dir/frontend-login.html")"
    if [[ -z "$static_asset" ]]; then
      static_asset="$(extract_static_asset_path "$tmp_dir/frontend-root.html")"
    fi
    if [[ -z "$static_asset" ]]; then
      log_err "Nao foi possivel localizar asset estatico no frontend publicado."
      status=1
    elif ! check_frontend_http_endpoint "http://127.0.0.1:${frontend_port}${static_asset}" "asset estatico publicado ${static_asset}" "$tmp_dir/frontend-static.bin"; then
      status=1
    elif [[ -f "$CURRENT_LINK/apps/frontend/public/clear-cache.html" ]] && \
      ! check_frontend_http_endpoint "http://127.0.0.1:${frontend_port}/clear-cache.html" "asset publico clear-cache publicado" "$tmp_dir/frontend-clear-cache.html"; then
      status=1
    elif ! validate_runtime_version_identity "$backend_port" "$expected_version" "$tmp_dir"; then
      status=1
    fi
  fi

  cleanup_live_validation
  return "$status"
}

run_seed_deploy() {
  local backend_dir="$1/apps/backend"
  log "Executando seed versionado (apenas pendentes)..."
  (
    cd "$backend_dir"
    # shellcheck disable=SC1091
    source ./.env
    resolve_seed_command "$backend_dir" || {
      log_err "$LAST_SEED_RESOLUTION_ERROR"
      return 1
    }
    log "Seed versionado resolvido via ${SEED_COMMAND_SOURCE}: ${SEED_COMMAND_BIN} ${SEED_COMMAND_ARGS[*]}"
    "$SEED_COMMAND_BIN" "${SEED_COMMAND_ARGS[@]}"
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
  local current_target=""
  local previous_target=""
  local kept=0
  local release_path=""
  current_target="$(get_link_target "$CURRENT_LINK")"
  previous_target="$(get_link_target "$PREVIOUS_LINK")"

  log "Limpando releases antigas (mantendo ${RELEASES_TO_KEEP} mais recentes, preservando current/previous)..."

  while IFS= read -r release_path; do
    [[ -n "$release_path" ]] || continue

    if [[ "$release_path" == "$current_target" ]] || [[ "$release_path" == "$previous_target" ]]; then
      log "Preservando release protegida: $release_path"
      continue
    fi

    if (( kept < RELEASES_TO_KEEP )); then
      kept=$((kept + 1))
      continue
    fi

    rm -rf "$release_path"
  done < <(ls -1dt "${RELEASES_DIR}"/* 2>/dev/null || true)
}

# =============================================================================
# Main Execution Flow
# =============================================================================

parse_args "$@"
resolve_base_dir
prepare_base_layout
initialize_logging_and_state
acquire_lock

trap 'release_lock' EXIT

start_state
bootstrap_atomic_layout

set_step "precheck" 5
ensure_command pm2 "$EXIT_PM2_FAILED"
ensure_shared_env || fail_and_exit "$EXIT_PACKAGE_INTEGRITY_FAILED" "precheck" "UPDATE_PACKAGE_INTEGRITY_ERROR" "UPDATE_PACKAGE_INTEGRITY_ERROR" \
  "Falha ao preparar os arquivos compartilhados da release." "Falha ao garantir shared/.env"
ensure_shared_frontend_env

load_runtime_env_from_shared

set_step "prepare" 10
NEW_RELEASE_DIR="${RELEASES_DIR}/$(sanitize_release_name "$TARGET_TAG")"

set_step "download" 20
ensure_release_code "$TARGET_TAG" "$NEW_RELEASE_DIR" || fail_and_exit "$EXIT_DOWNLOAD_FAILED" "download" "UPDATE_DOWNLOAD_ERROR" "UPDATE_DOWNLOAD_ERROR" \
  "Falha ao preparar a release alvo." "${LAST_RELEASE_PREPARATION_ERROR:-Falha ao preparar a release alvo para o retry da mesma versao.}"
link_shared_into_release "$NEW_RELEASE_DIR" || fail_and_exit "$EXIT_PUBLISH_FAILED" "prepare" "UPDATE_PUBLISH_ERROR" "UPDATE_PUBLISH_ERROR" \
  "Falha ao preparar os links compartilhados da release." "Nao foi possivel vincular shared/.env/uploads/backups na nova release"
reset_release_build_outputs "$NEW_RELEASE_DIR"

set_step "install_dependencies" 35
log "Instalando dependencias..."
cd "$NEW_RELEASE_DIR"
ensure_command pnpm "$EXIT_INSTALL_FAILED"
pnpm install --frozen-lockfile --prod=false || fail_and_exit "$EXIT_INSTALL_FAILED" "install_dependencies" "UPDATE_INSTALL_ERROR" "UPDATE_INSTALL_ERROR" \
  "Falha ao instalar dependencias do projeto." "$(recent_failure_detail 'pnpm install --frozen-lockfile --prod=false falhou na nova release')"

set_step "build_prisma_client" 44
log "Gerando cliente Prisma do backend..."
pnpm --filter backend exec prisma generate || fail_and_exit "$EXIT_BUILD_FAILED" "build_prisma_client" "UPDATE_BUILD_ERROR" "UPDATE_BUILD_ERROR" \
  "Falha ao gerar o cliente Prisma da nova release." "$(recent_failure_detail 'pnpm --filter backend exec prisma generate falhou')"

set_step "build_backend" 48
log "Compilando backend..."
pnpm --filter backend build || fail_and_exit "$EXIT_BUILD_FAILED" "build_backend" "UPDATE_BUILD_ERROR" "UPDATE_BUILD_ERROR" \
  "Falha ao compilar o backend da nova release." "$(recent_failure_detail 'pnpm --filter backend build falhou')"

set_step "build_frontend" 54
log "Compilando frontend..."
NEXT_DIST_DIR=".next" pnpm --filter frontend build || fail_and_exit "$EXIT_BUILD_FAILED" "build_frontend" "UPDATE_BUILD_ERROR" "UPDATE_BUILD_ERROR" \
  "Falha ao compilar o frontend da nova release." "$(recent_failure_detail 'pnpm --filter frontend build falhou')"
resolve_frontend_standalone_layout "$NEW_RELEASE_DIR/apps/frontend" || fail_and_exit "$EXIT_BUILD_FAILED" "build_frontend" "UPDATE_BUILD_ERROR" "UPDATE_BUILD_ERROR" \
  "O build do frontend concluiu sem gerar um entrypoint standalone valido." "${LAST_FRONTEND_ARTIFACT_ERROR:-Standalone do frontend nao encontrado apos o build}"
log "Entrypoint standalone do frontend gerado: ${FRONTEND_STANDALONE_LAYOUT} (${FRONTEND_STANDALONE_ENTRY_REL})"

set_step "package_frontend_assets" 58
log "Preparando o artefato standalone do frontend..."
copy_frontend_runtime_assets "$NEW_RELEASE_DIR" || fail_and_exit "$EXIT_PACKAGE_INTEGRITY_FAILED" "package_frontend_assets" "UPDATE_PACKAGE_INTEGRITY_ERROR" "UPDATE_PACKAGE_INTEGRITY_ERROR" \
  "Falha ao preparar o artefato standalone do frontend." "${LAST_FRONTEND_ARTIFACT_ERROR:-Falha ao copiar public/.next/static para o standalone do frontend}"

set_step "validate_frontend_artifact" 62
log "Validando a integridade do artefato standalone do frontend..."
validate_frontend_artifact_layout "$NEW_RELEASE_DIR" || fail_and_exit "$EXIT_PACKAGE_INTEGRITY_FAILED" "validate_frontend_artifact" "UPDATE_PACKAGE_INTEGRITY_ERROR" "UPDATE_PACKAGE_INTEGRITY_ERROR" \
  "Artefato standalone do frontend esta incompleto." "${LAST_FRONTEND_ARTIFACT_ERROR:-A validacao estrutural do standalone do frontend falhou}"

set_step "pre_swap_smoke_test" 66
log "Executando smoke test do frontend antes do swap..."
smoke_test_frontend_release "$NEW_RELEASE_DIR" 5100 || fail_and_exit "$EXIT_PACKAGE_INTEGRITY_FAILED" "pre_swap_smoke_test" "UPDATE_PACKAGE_INTEGRITY_ERROR" "UPDATE_PACKAGE_INTEGRITY_ERROR" \
  "A nova release falhou no smoke test do frontend antes do swap." "O frontend standalone nao respondeu corretamente antes da publicacao da release"

set_step "migrate" 72
log "Executando migrations..."
cd "$NEW_RELEASE_DIR/apps/backend"
pnpm prisma migrate deploy --schema prisma/schema.prisma || fail_and_exit "$EXIT_MIGRATE_FAILED" "migrate" "UPDATE_MIGRATE_ERROR" "UPDATE_MIGRATE_ERROR" \
  "Falha ao aplicar as migrations da nova release." "$(recent_failure_detail 'pnpm prisma migrate deploy --schema prisma/schema.prisma falhou')"

set_step "seed" 78
run_seed_deploy "$NEW_RELEASE_DIR" || fail_and_exit "$EXIT_SEED_FAILED" "seed" "UPDATE_SEED_ERROR" "UPDATE_SEED_ERROR" \
  "Falha ao aplicar o seed versionado da nova release." "$(recent_failure_detail "${LAST_SEED_RESOLUTION_ERROR:-Falha ao executar o seed versionado da release}")"

set_step "publish_release" 84
enable_maintenance_mode "Atualizando sistema para versao ${TARGET_TAG}"

CURRENT_TARGET="$(get_link_target "$CURRENT_LINK")"
if [[ -n "$CURRENT_TARGET" ]] && [[ "$CURRENT_TARGET" != "$NEW_RELEASE_DIR" ]]; then
  ln -sfn "$CURRENT_TARGET" "$PREVIOUS_LINK" || fail_and_exit "$EXIT_PUBLISH_FAILED" "publish_release" "UPDATE_PUBLISH_ERROR" "UPDATE_PUBLISH_ERROR" \
    "Falha ao atualizar o ponteiro da release anterior." "Nao foi possivel atualizar o link previous para ${CURRENT_TARGET}"
fi

resolve_build_metadata "$NEW_RELEASE_DIR"
write_build_metadata_files "$NEW_RELEASE_DIR"
ln -sfn "$NEW_RELEASE_DIR" "$CURRENT_LINK" || fail_and_exit "$EXIT_PUBLISH_FAILED" "publish_release" "UPDATE_PUBLISH_ERROR" "UPDATE_PUBLISH_ERROR" \
  "Falha ao publicar a nova release ativa." "Nao foi possivel atualizar o link current para ${NEW_RELEASE_DIR}"

set_step "restart_pm2" 90
restart_pm2_processes "$NEW_RELEASE_DIR" || fail_and_exit "$EXIT_PM2_FAILED" "restart_pm2" "UPDATE_PM2_START_ERROR" "UPDATE_PM2_START_ERROR" \
  "Falha ao iniciar os processos PM2 da nova release." "PM2 nao conseguiu iniciar backend/frontend com a nova release"

set_step "validate_backend_storage" 93
log "Validando storage compartilhado do backend..."
validate_backend_shared_storage "$NEW_RELEASE_DIR" || fail_and_exit "$EXIT_POST_DEPLOY_VALIDATION_FAILED" "validate_backend_storage" "UPDATE_POST_DEPLOY_VALIDATION_ERROR" "UPDATE_POST_DEPLOY_VALIDATION_ERROR" \
  "Falha ao validar o storage compartilhado do backend apos o deploy." "O backend da nova release nao conseguiu operar no storage compartilhado"

set_step "post_deploy_validation" 97
log "Validando backend, frontend, assets estaticos e rotas criticas apos o swap..."
if validate_live_runtime 4000 5000 "$NEW_RELEASE_DIR" "$TARGET_TAG"; then
  log "Sistema saudavel."
else
  log_err "Validacao pos-deploy falhou. Iniciando rollback..."
  ROLLBACK_ATTEMPTED="true"
  PREV_TARGET="$(get_link_target "$PREVIOUS_LINK")"
  if [[ -n "$PREV_TARGET" ]] && [[ -d "$PREV_TARGET" ]]; then
    ln -sfn "$PREV_TARGET" "$CURRENT_LINK" || fail_and_exit "$EXIT_HEALTH_ROLLBACK_FAILED" "publish_release" "UPDATE_ROLLBACK_ERROR" "UPDATE_ROLLBACK_ERROR" \
      "Falha ao reposicionar current para a release anterior durante o rollback." "Nao foi possivel atualizar current para ${PREV_TARGET} durante o rollback"
    restart_pm2_processes "$PREV_TARGET" || fail_and_exit "$EXIT_HEALTH_ROLLBACK_FAILED" "rollback" "UPDATE_ROLLBACK_ERROR" "UPDATE_ROLLBACK_ERROR" \
      "Falha ao reiniciar PM2 durante o rollback automatico." "PM2 nao conseguiu reiniciar a release anterior durante o rollback"
    ROLLBACK_COMPLETED="true"
    ROLLBACK_REASON="Validacao pos-deploy falhou apos update para ${TARGET_TAG}"
    finish_rolled_back "$ROLLBACK_REASON" "post_deploy_validation" "UPDATE_POST_DEPLOY_VALIDATION_ERROR" "UPDATE_POST_DEPLOY_VALIDATION_ERROR" \
      "A nova release falhou na validacao pos-deploy e o rollback automatico foi aplicado." "$EXIT_HEALTH_ROLLBACK_OK"
    ensure_maintenance_on_failure "Sistema em rollback devido a falha crítica."
    exit "$EXIT_HEALTH_ROLLBACK_OK"
  else
    ROLLBACK_COMPLETED="false"
    ROLLBACK_REASON="Validacao pos-deploy falhou e nao ha release anterior para rollback."
    fail_and_exit "$EXIT_HEALTH_ROLLBACK_FAILED" "post_deploy_validation" "UPDATE_POST_DEPLOY_VALIDATION_ERROR" "UPDATE_POST_DEPLOY_VALIDATION_ERROR" \
      "A nova release falhou na validacao pos-deploy e nao houve rollback disponivel." "$ROLLBACK_REASON"
  fi
fi

cleanup_old_releases
disable_maintenance_mode "Update concluido com sucesso"
finish_success
exit "$EXIT_SUCCESS"
