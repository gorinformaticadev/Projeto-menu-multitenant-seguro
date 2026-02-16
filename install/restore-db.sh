#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-install/.env.production}"
BACKUPS_DIR="${BACKUPS_DIR:-${PROJECT_ROOT}/backups}"
BACKUP_FILE="${BACKUP_FILE:-}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-false}"
RESTORE_MODE="${RESTORE_MODE:-restore-only}"
TARGET_RELEASE_TAG="${TARGET_RELEASE_TAG:-}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

log() {
  echo "[restore] $*"
}

log_err() {
  echo "[restore] ERROR: $*" >&2
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_for_backend_healthy() {
  local timeout="$1"
  local start_ts now_ts elapsed cid health_status

  start_ts="$(date +%s)"
  while true; do
    cid="$(compose ps -q backend | head -n 1)"
    if [ -z "$cid" ]; then
      log_err "container backend nao encontrado"
      return 1
    fi

    health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$cid" 2>/dev/null || echo 'inspect-error')"
    case "$health_status" in
      healthy)
        log "backend esta HEALTHY"
        return 0
        ;;
      starting)
        ;;
      no-healthcheck)
        log_err "backend sem healthcheck. Adicione healthcheck no compose."
        return 1
        ;;
      unhealthy|inspect-error)
        log_err "backend em estado invalido: $health_status"
        return 1
        ;;
      *)
        log "aguardando health backend: $health_status"
        ;;
    esac

    now_ts="$(date +%s)"
    elapsed=$((now_ts - start_ts))
    if [ "$elapsed" -ge "$timeout" ]; then
      log_err "timeout aguardando backend healthy (${timeout}s)"
      return 1
    fi

    sleep 5
  done
}

if ! docker compose version >/dev/null 2>&1; then
  log_err "docker compose v2 nao disponivel"
  exit 1
fi

case "$COMPOSE_FILE" in
  docker-compose.prod.yml|docker-compose.prod.external.yml) ;;
  *)
    log_err "compose file nao permitido: $COMPOSE_FILE"
    exit 1
    ;;
esac

case "$ENV_FILE" in
  install/.env.production|.env.production|.env) ;;
  *)
    log_err "env file nao permitido: $ENV_FILE"
    exit 1
    ;;
esac

if [ -z "$BACKUP_FILE" ]; then
  log_err "BACKUP_FILE nao informado"
  exit 1
fi

backup_name="$(basename "$BACKUP_FILE")"
if [ "$backup_name" != "$BACKUP_FILE" ]; then
  log_err "nome de arquivo invalido"
  exit 1
fi

if ! echo "$backup_name" | grep -Eq '^[a-zA-Z0-9._-]+$'; then
  log_err "nome de arquivo invalido"
  exit 1
fi

cd "$PROJECT_ROOT"

if [ ! -f "$ENV_FILE" ]; then
  log_err "arquivo env nao encontrado: $ENV_FILE"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  log_err "arquivo compose nao encontrado: $COMPOSE_FILE"
  exit 1
fi

backups_dir_real="$(cd "$BACKUPS_DIR" && pwd)"
backup_path_real="$(cd "$BACKUPS_DIR" && cd "$(dirname "$backup_name")" && pwd)/$(basename "$backup_name")"

if [[ "$backup_path_real" != "$backups_dir_real"/* ]]; then
  log_err "arquivo fora do diretorio de backups"
  exit 1
fi

if [ ! -f "$backup_path_real" ]; then
  log_err "backup nao encontrado: $backup_name"
  exit 1
fi

case "$RESTORE_MODE" in
  restore-only|drop-and-restore) ;;
  *)
    log_err "RESTORE_MODE invalido: $RESTORE_MODE"
    exit 1
    ;;
esac

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

DB_USER="${DB_USER:-}"
DB_NAME="${DB_NAME:-}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ] || [ -z "$DB_PASSWORD" ]; then
  log_err "DB_USER/DB_NAME/DB_PASSWORD precisam estar definidos no env"
  exit 1
fi

if [ -n "$TARGET_RELEASE_TAG" ]; then
  export RELEASE_TAG="$TARGET_RELEASE_TAG"
  log "target release tag para backend apos restore: $TARGET_RELEASE_TAG"
fi

safety_file="${backups_dir_real}/safety_pre_restore_$(date +%Y%m%d_%H%M%S).dump"
log "criando backup de seguranca antes do restore: $(basename "$safety_file")"
compose exec -T -e PGPASSWORD="$DB_PASSWORD" db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$safety_file"

log "parando backend"
compose stop backend

ext="${backup_name##*.}"
case "$ext" in
  sql)
    log "restaurando arquivo SQL via psql"
    if [ "$RESTORE_MODE" = "drop-and-restore" ]; then
      log "modo drop-and-restore: resetando schema public"
      compose exec -T -e PGPASSWORD="$DB_PASSWORD" db psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
    fi
    cat "$backup_path_real" | compose exec -T -e PGPASSWORD="$DB_PASSWORD" db psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"
    ;;
  dump|backup)
    log "restaurando arquivo dump via pg_restore"
    if [ "$RESTORE_MODE" = "drop-and-restore" ]; then
      cat "$backup_path_real" | compose exec -T -e PGPASSWORD="$DB_PASSWORD" db pg_restore -v --clean --if-exists --no-owner --no-acl -U "$DB_USER" -d "$DB_NAME"
    else
      cat "$backup_path_real" | compose exec -T -e PGPASSWORD="$DB_PASSWORD" db pg_restore -v --no-owner --no-acl -U "$DB_USER" -d "$DB_NAME"
    fi
    ;;
  *)
    log_err "extensao nao suportada: .$ext"
    exit 1
    ;;
esac

log "subindo backend"
compose up -d backend
wait_for_backend_healthy "$HEALTH_TIMEOUT"

if [ "$RUN_MIGRATIONS" = "true" ] && compose config --services | grep -qx "migrate"; then
  log "executando migrate pos-restore"
  compose run --rm migrate
elif [ "$RUN_MIGRATIONS" = "true" ]; then
  log "service migrate nao encontrado (skip)"
fi

log "restore concluido com sucesso"
