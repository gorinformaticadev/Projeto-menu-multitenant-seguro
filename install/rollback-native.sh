#!/usr/bin/env bash
# =============================================================================
# Rollback manual para modelo atomico BASE_DIR/releases/current/shared
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
APP_BASE_DIR="${APP_BASE_DIR:-}"
TARGET_RELEASE="${TARGET_RELEASE:-previous}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
LIST_ONLY="false"
LOCK_FD=98

BASE_DIR=""
RELEASES_DIR=""
SHARED_DIR=""
CURRENT_LINK=""
PREVIOUS_LINK=""
LOCK_FILE=""
BACKEND_PROC=""
FRONTEND_PROC=""

log() {
  echo "[native-rollback] $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_err() {
  echo "[native-rollback] ERROR: $*" >&2
}

ensure_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_err "Comando obrigatorio nao encontrado: $cmd"
    exit 1
  fi
}

usage() {
  cat <<'EOF'
Uso:
  bash install/rollback-native.sh [opcoes]

Opcoes:
  --list                Lista releases disponiveis e status atual
  --to <release>        Rollback para "previous" (padrao) ou nome da release
  --base-dir <dir>      Define BASE_DIR (padrao: APP_BASE_DIR ou autodetect)
  --help                Mostra ajuda
EOF
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
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --list)
        LIST_ONLY="true"
        shift
        ;;
      --to)
        TARGET_RELEASE="$2"
        shift 2
        ;;
      --base-dir)
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

acquire_lock() {
  mkdir -p "$SHARED_DIR/locks"
  eval "exec ${LOCK_FD}>\"${LOCK_FILE}\""
  if ! flock -n "$LOCK_FD"; then
    log_err "Outro update/rollback em andamento. Lock ativo em $LOCK_FILE"
    exit 1
  fi
}

release_lock() {
  flock -u "$LOCK_FD" || true
  eval "exec ${LOCK_FD}>&-"
}

discover_pm2_name() {
  local token="$1"
  pm2 jlist 2>/dev/null | grep -oE "\"name\":\"[^\"]*${token}[^\"]*\"" | head -n1 | cut -d'"' -f4 || true
}

restart_pm2_processes() {
  local target_root="$1"
  local backend_name="${PM2_BACKEND_NAME:-$BACKEND_PROC}"
  local frontend_name="${PM2_FRONTEND_NAME:-$FRONTEND_PROC}"

  [[ -n "$backend_name" ]] || backend_name="multitenant-backend"
  [[ -n "$frontend_name" ]] || frontend_name="multitenant-frontend"

  pm2 delete "$backend_name" >/dev/null 2>&1 || true
  pm2 delete "$frontend_name" >/dev/null 2>&1 || true

  pm2 start dist/main.js --name "$backend_name" --cwd "$target_root/apps/backend" --update-env
  pm2 start "pnpm start" --name "$frontend_name" --cwd "$target_root/apps/frontend" --update-env
  pm2 save

  BACKEND_PROC="$backend_name"
  FRONTEND_PROC="$frontend_name"
}

load_runtime_env_from_shared() {
  if [[ ! -f "$SHARED_DIR/.env" ]]; then
    return 0
  fi
  set -a
  # shellcheck disable=SC1090
  source "$SHARED_DIR/.env"
  set +a
}

wait_for_http_ok() {
  local url="$1"
  local timeout="$2"
  local label="$3"
  local started_at
  started_at="$(date +%s)"

  while true; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      log "${label} OK: ${url}"
      return 0
    fi
    local now
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

list_releases() {
  local current_target=""
  local previous_target=""
  [[ -L "$CURRENT_LINK" ]] && current_target="$(readlink -f "$CURRENT_LINK")"
  [[ -L "$PREVIOUS_LINK" ]] && previous_target="$(readlink -f "$PREVIOUS_LINK")"

  echo "BASE_DIR: $BASE_DIR"
  echo "CURRENT:  ${current_target:-<nao definido>}"
  echo "PREVIOUS: ${previous_target:-<nao definido>}"
  echo ""
  echo "Releases:"

  if [[ ! -d "$RELEASES_DIR" ]]; then
    echo "  (nenhuma)"
    return 0
  fi

  local release_dir=""
  while IFS= read -r release_dir; do
    local marker=""
    if [[ -n "$current_target" && "$release_dir" == "$current_target" ]]; then
      marker="[current]"
    elif [[ -n "$previous_target" && "$release_dir" == "$previous_target" ]]; then
      marker="[previous]"
    fi
    echo "  - $(basename "$release_dir") $marker"
  done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
}

resolve_target_release_path() {
  local requested="$1"
  if [[ "$requested" == "previous" ]]; then
    if [[ -L "$PREVIOUS_LINK" ]]; then
      readlink -f "$PREVIOUS_LINK"
      return 0
    fi
    echo ""
    return 0
  fi

  if [[ "$requested" == "current" ]]; then
    if [[ -L "$CURRENT_LINK" ]]; then
      readlink -f "$CURRENT_LINK"
      return 0
    fi
    echo ""
    return 0
  fi

  if [[ "$requested" = /* ]] && [[ -d "$requested" ]]; then
    echo "$(cd "$requested" && pwd)"
    return 0
  fi

  if [[ -d "$RELEASES_DIR/$requested" ]]; then
    echo "$RELEASES_DIR/$requested"
    return 0
  fi

  echo ""
}

main() {
  parse_args "$@"
  resolve_base_dir

  ensure_command flock
  ensure_command pm2
  ensure_command curl

  if [[ "$LIST_ONLY" == "true" ]]; then
    list_releases
    return 0
  fi

  if [[ ! -d "$RELEASES_DIR" ]]; then
    log_err "Diretorio de releases nao encontrado: $RELEASES_DIR"
    exit 1
  fi
  if [[ ! -L "$CURRENT_LINK" ]]; then
    log_err "Link current nao encontrado em $CURRENT_LINK"
    exit 1
  fi

  local target_release_path
  target_release_path="$(resolve_target_release_path "$TARGET_RELEASE")"
  if [[ -z "$target_release_path" ]] || [[ ! -d "$target_release_path" ]]; then
    log_err "Release alvo invalida: $TARGET_RELEASE"
    exit 1
  fi

  local current_target
  current_target="$(readlink -f "$CURRENT_LINK")"
  if [[ "$target_release_path" == "$current_target" ]]; then
    log "Release alvo ja esta ativa em current: $target_release_path"
    return 0
  fi

  acquire_lock
  trap release_lock EXIT

  BACKEND_PROC="$(discover_pm2_name backend)"
  FRONTEND_PROC="$(discover_pm2_name frontend)"

  log "Aplicando rollback: current -> $target_release_path"
  ln -sfn "$current_target" "$PREVIOUS_LINK"
  ln -sfn "$target_release_path" "$CURRENT_LINK"

  if ! restart_pm2_processes "$CURRENT_LINK"; then
    log_err "Falha ao reiniciar PM2 apos rollback."
    ln -sfn "$current_target" "$CURRENT_LINK"
    exit 1
  fi

  if ! run_healthchecks; then
    log_err "Healthcheck falhou apos rollback. Revertendo current para release anterior."
    ln -sfn "$current_target" "$CURRENT_LINK"
    restart_pm2_processes "$CURRENT_LINK" || true
    log "ROLLBACK_COMPLETED: rollback revertido por falha de healthcheck"
    exit 1
  fi

  log "Rollback concluido com sucesso. current -> $(readlink -f "$CURRENT_LINK")"
}

main "$@"
