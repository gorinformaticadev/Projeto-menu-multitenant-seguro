#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_ROOT="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="$RELEASE_ROOT/.deploy-runtime"
VALIDATION_DIR="$RUNTIME_DIR/validation"
BACKEND_PID_FILE="$VALIDATION_DIR/backend.pid"
FRONTEND_PID_FILE="$VALIDATION_DIR/frontend.pid"
BACKEND_LOG_FILE="$VALIDATION_DIR/backend.log"
FRONTEND_LOG_FILE="$VALIDATION_DIR/frontend.log"
DEFAULT_VALIDATION_HOST="${VALIDATION_HOST:-127.0.0.1}"
DEFAULT_VALIDATION_BACKEND_PORT="${VALIDATION_BACKEND_PORT:-4100}"
DEFAULT_VALIDATION_FRONTEND_PORT="${VALIDATION_FRONTEND_PORT:-5100}"

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy][ERROR] %s\n' "$*" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || fail "Comando obrigatorio ausente: $command_name"
}

read_env_value() {
  local file_path="$1"
  local key="$2"
  local default_value="${3:-}"
  local value=""

  if [[ -f "$file_path" ]]; then
    value="$(grep -E "^${key}=" "$file_path" | tail -n 1 | cut -d= -f2- || true)"
  fi

  if [[ -z "$value" ]]; then
    value="$default_value"
  fi

  printf '%s\n' "$value"
}

resolve_backend_port() {
  read_env_value "$RELEASE_ROOT/apps/backend/.env" "PORT" "${PUBLISHED_BACKEND_PORT:-4000}"
}

resolve_frontend_port() {
  if [[ -n "${PUBLISHED_FRONTEND_PORT:-}" ]]; then
    printf '%s\n' "$PUBLISHED_FRONTEND_PORT"
    return 0
  fi
  printf '%s\n' "5000"
}

ensure_release_layout() {
  [[ -d "$RELEASE_ROOT/apps/backend" ]] || fail "apps/backend nao encontrado em $RELEASE_ROOT"
  [[ -d "$RELEASE_ROOT/apps/frontend" ]] || fail "apps/frontend nao encontrado em $RELEASE_ROOT"
  [[ -f "$RELEASE_ROOT/apps/backend/package.json" ]] || fail "package.json do backend nao encontrado"
  [[ -f "$RELEASE_ROOT/apps/frontend/package.json" ]] || fail "package.json do frontend nao encontrado"
}

run_pnpm() {
  (cd "$RELEASE_ROOT" && "$@")
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  local sleep_seconds="${4:-2}"
  local attempt=1

  while [[ "$attempt" -le "$attempts" ]]; do
    if curl --silent --show-error --fail "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_seconds"
    attempt=$((attempt + 1))
  done

  fail "Healthcheck falhou para $label em $url"
}

kill_pid_file() {
  local pid_file="$1"
  local label="$2"
  local pid=""

  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    wait "$pid" 2>/dev/null || true
  fi

  rm -f "$pid_file"
  log "$label finalizado"
}

cmd_preflight() {
  ensure_release_layout
  require_command node
  require_command corepack
  require_command curl

  [[ -f "$RELEASE_ROOT/apps/backend/.env" ]] || fail "apps/backend/.env precisa existir na release antes do deploy"

  log "Preflight da release OK em $RELEASE_ROOT"
}

cmd_full() {
  cmd_preflight
  log "Instalando dependencias da release"
  run_pnpm corepack pnpm install --frozen-lockfile
  log "Gerando Prisma Client"
  run_pnpm corepack pnpm --filter backend prisma:generate
  log "Buildando backend"
  run_pnpm corepack pnpm --filter backend build
  log "Buildando frontend"
  run_pnpm corepack pnpm --filter frontend build
  log "Aplicando migrations"
  run_pnpm corepack pnpm --filter backend prisma:migrate
  log "Executando seed versionado"
  run_pnpm corepack pnpm --filter backend seed:deploy
}

cmd_start_validation() {
  local host="$DEFAULT_VALIDATION_HOST"
  local backend_port="$DEFAULT_VALIDATION_BACKEND_PORT"
  local frontend_port="$DEFAULT_VALIDATION_FRONTEND_PORT"

  mkdir -p "$VALIDATION_DIR"
  cmd_stop_validation >/dev/null 2>&1 || true

  log "Subindo backend temporario em ${host}:${backend_port}"
  (
    cd "$RELEASE_ROOT/apps/backend"
    PROJECT_ROOT="$RELEASE_ROOT" \
    APP_BASE_DIR="$RELEASE_ROOT" \
    PORT="$backend_port" \
    HOST="$host" \
    nohup node dist/main.js >"$BACKEND_LOG_FILE" 2>&1 &
    printf '%s\n' "$!" >"$BACKEND_PID_FILE"
  )

  log "Subindo frontend temporario em ${host}:${frontend_port}"
  (
    cd "$RELEASE_ROOT/apps/frontend"
    PORT="$frontend_port" \
    HOSTNAME="$host" \
    NEXT_PUBLIC_API_URL="http://${host}:${backend_port}/api" \
    nohup node scripts/start-standalone.mjs >"$FRONTEND_LOG_FILE" 2>&1 &
    printf '%s\n' "$!" >"$FRONTEND_PID_FILE"
  )
}

cmd_health_validation() {
  local host="$DEFAULT_VALIDATION_HOST"
  local backend_port="$DEFAULT_VALIDATION_BACKEND_PORT"
  local frontend_port="$DEFAULT_VALIDATION_FRONTEND_PORT"

  wait_for_http "http://${host}:${backend_port}/api/health" "backend de validacao"
  wait_for_http "http://${host}:${frontend_port}" "frontend de validacao"
  log "Healthcheck da validacao temporaria OK"
}

cmd_stop_validation() {
  kill_pid_file "$BACKEND_PID_FILE" "Backend de validacao"
  kill_pid_file "$FRONTEND_PID_FILE" "Frontend de validacao"
}

cmd_activate() {
  local backend_name=""
  local frontend_name=""
  local backend_port=""
  local frontend_port=""

  require_command pm2
  : "${APP_INSTANCE_NAME:?APP_INSTANCE_NAME precisa estar definido para activate}"

  backend_name="${APP_INSTANCE_NAME}-backend"
  frontend_name="${APP_INSTANCE_NAME}-frontend"
  backend_port="$(resolve_backend_port)"
  frontend_port="$(resolve_frontend_port)"

  log "Ativando release publicada para a instancia $APP_INSTANCE_NAME"
  pm2 delete "$backend_name" >/dev/null 2>&1 || true
  pm2 delete "$frontend_name" >/dev/null 2>&1 || true

  PROJECT_ROOT="$RELEASE_ROOT" \
  APP_BASE_DIR="$RELEASE_ROOT" \
  PORT="$backend_port" \
  pm2 start dist/main.js --name "$backend_name" --cwd "$RELEASE_ROOT/apps/backend" --update-env

  PORT="$frontend_port" \
  HOSTNAME="0.0.0.0" \
  pm2 start "node scripts/start-standalone.mjs" --name "$frontend_name" --cwd "$RELEASE_ROOT/apps/frontend" --update-env

  pm2 save >/dev/null
}

cmd_health_published() {
  local host="${PUBLISHED_HOST:-127.0.0.1}"
  local backend_port=""
  local frontend_port=""

  backend_port="$(resolve_backend_port)"
  frontend_port="$(resolve_frontend_port)"

  wait_for_http "http://${host}:${backend_port}/api/health" "backend publicado"
  wait_for_http "http://${host}:${frontend_port}" "frontend publicado"
  log "Healthcheck da release publicada OK"
}

cmd_version() {
  if [[ -f "$RELEASE_ROOT/VERSION" ]]; then
    head -n 1 "$RELEASE_ROOT/VERSION" | tr -d '\r'
    return 0
  fi

  node -p "require('./apps/backend/package.json').version" 2>/dev/null || printf 'unknown\n'
}

main() {
  local command="${1:-}"

  cd "$RELEASE_ROOT"

  case "$command" in
    preflight)
      cmd_preflight
      ;;
    full)
      cmd_full
      ;;
    start-validation)
      cmd_start_validation
      ;;
    health)
      cmd_health_validation
      ;;
    stop-validation)
      cmd_stop_validation
      ;;
    activate)
      cmd_activate
      ;;
    published-health)
      cmd_health_published
      ;;
    version)
      cmd_version
      ;;
    *)
      cat <<'EOF' >&2
Uso:
  bash Scripts/deploy.sh preflight
  bash Scripts/deploy.sh full
  bash Scripts/deploy.sh start-validation
  bash Scripts/deploy.sh health
  bash Scripts/deploy.sh stop-validation
  bash Scripts/deploy.sh activate
  bash Scripts/deploy.sh published-health
  bash Scripts/deploy.sh version
EOF
      exit 1
      ;;
  esac
}

main "$@"
