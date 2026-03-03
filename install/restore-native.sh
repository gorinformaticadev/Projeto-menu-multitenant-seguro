#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUPS_DIR="${BACKUPS_DIR:-${PROJECT_ROOT}/backups}"
BACKUP_FILE="${BACKUP_FILE:-}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-false}"
RESTORE_MODE="${RESTORE_MODE:-restore-only}"
TARGET_RELEASE_TAG="${TARGET_RELEASE_TAG:-}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:4000/api/health}"

DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-}"
DATABASE_URL="${DATABASE_URL:-}"

backend_proc=""
backend_was_stopped="false"
backend_restarted="false"
PG_RESTORE_BIN=""
PG_DUMP_BIN=""
PSQL_BIN=""

log() {
  echo "[restore-native] $*"
}

log_err() {
  echo "[restore-native] ERROR: $*" >&2
}

handle_failure() {
  local exit_code="$1"
  set +e
  if [ "$backend_was_stopped" = "true" ] && [ "$backend_restarted" != "true" ]; then
    log_err "restore interrompido; tentando religar backend"
    if [ -n "$backend_proc" ]; then
      pm2 restart "$backend_proc" >/dev/null 2>&1 || true
    else
      pm2 start apps/backend/dist/main.js --name "multitenant-backend" --cwd "$PROJECT_ROOT/apps/backend" >/dev/null 2>&1 || true
    fi
    pm2 save >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}

trap 'handle_failure $?' ERR

resolve_default_pg_clients() {
  PG_RESTORE_BIN="$(command -v pg_restore 2>/dev/null || true)"
  PG_DUMP_BIN="$(command -v pg_dump 2>/dev/null || true)"
  PSQL_BIN="$(command -v psql 2>/dev/null || true)"
}

resolve_pg_clients_from_restore() {
  local restore_bin="$1"
  local bin_dir
  bin_dir="$(dirname "$restore_bin")"

  PG_RESTORE_BIN="$restore_bin"
  if [ -x "$bin_dir/pg_dump" ]; then
    PG_DUMP_BIN="$bin_dir/pg_dump"
  fi
  if [ -x "$bin_dir/psql" ]; then
    PSQL_BIN="$bin_dir/psql"
  fi
}

select_pg_restore_binary_for_dump() {
  local dump_file="$1"
  local -a candidates=()
  local candidate=""
  local tmp_err=""
  local err_text=""
  local last_error=""
  local unsupported_seen="false"
  local found_any="false"
  declare -A seen=()

  if command -v pg_restore >/dev/null 2>&1; then
    candidates+=("$(command -v pg_restore)")
  fi
  while IFS= read -r candidate; do
    [ -n "$candidate" ] && candidates+=("$candidate")
  done < <(ls -1d /usr/lib/postgresql/*/bin/pg_restore 2>/dev/null | sort -Vr || true)

  for candidate in "${candidates[@]}"; do
    if [ -z "$candidate" ] || [ ! -x "$candidate" ]; then
      continue
    fi
    if [ -n "${seen[$candidate]+x}" ]; then
      continue
    fi
    seen[$candidate]=1
    found_any="true"

    tmp_err="$(mktemp)"
    if "$candidate" --list "$dump_file" >/dev/null 2>"$tmp_err"; then
      rm -f "$tmp_err"
      resolve_pg_clients_from_restore "$candidate"
      log "cliente PostgreSQL selecionado para dump: $("$PG_RESTORE_BIN" --version 2>/dev/null | head -n 1)"
      return 0
    fi

    err_text="$(tr -d '\r' < "$tmp_err")"
    rm -f "$tmp_err"
    last_error="$err_text"
    if echo "$err_text" | grep -qi "unsupported version"; then
      unsupported_seen="true"
    fi
  done

  if [ "$found_any" != "true" ]; then
    log_err "pg_restore nao disponivel"
    return 1
  fi

  if [ "$unsupported_seen" = "true" ]; then
    log_err "dump em versao mais nova que os clientes PostgreSQL instalados"
    log_err "instale cliente PostgreSQL compativel com o dump (mesma major do pg_dump que gerou o arquivo)"
  else
    log_err "arquivo dump corrompido ou invalido"
  fi
  if [ -n "$last_error" ]; then
    log_err "$last_error"
  fi
  return 1
}

try_parse_db_from_database_url() {
  if [ -n "$DB_HOST" ] && [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    return 0
  fi

  if [ -z "$DATABASE_URL" ]; then
    return 0
  fi

  if ! command -v node >/dev/null 2>&1; then
    return 0
  fi

  local parsed
  parsed="$(DATABASE_URL="$DATABASE_URL" node -e "const u=new URL(process.env.DATABASE_URL); console.log([u.hostname,u.port||'5432',decodeURIComponent(u.username||''),decodeURIComponent(u.password||''),u.pathname.replace(/^\\//,'')].join('\\n'))" 2>/dev/null || true)"
  if [ -z "$parsed" ]; then
    return 0
  fi

  DB_HOST="${DB_HOST:-$(echo "$parsed" | sed -n '1p')}"
  DB_PORT="${DB_PORT:-$(echo "$parsed" | sed -n '2p')}"
  DB_USER="${DB_USER:-$(echo "$parsed" | sed -n '3p')}"
  DB_PASSWORD="${DB_PASSWORD:-$(echo "$parsed" | sed -n '4p')}"
  DB_NAME="${DB_NAME:-$(echo "$parsed" | sed -n '5p')}"
}

wait_for_backend_healthy() {
  local timeout="$1"
  local start_ts now_ts elapsed

  start_ts="$(date +%s)"
  while true; do
    if curl -fsS "$BACKEND_HEALTH_URL" >/dev/null 2>&1; then
      log "backend esta HEALTHY"
      return 0
    fi

    now_ts="$(date +%s)"
    elapsed=$((now_ts - start_ts))
    if [ "$elapsed" -ge "$timeout" ]; then
      log_err "timeout aguardando backend healthy (${timeout}s) em ${BACKEND_HEALTH_URL}"
      return 1
    fi
    sleep 5
  done
}

if [ -z "$BACKUP_FILE" ]; then
  log_err "BACKUP_FILE nao informado"
  exit 1
fi

try_parse_db_from_database_url

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
  log_err "DB_HOST/DB_USER/DB_PASSWORD/DB_NAME precisam estar definidos para restore nativo"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  log_err "pm2 nao disponivel"
  exit 1
fi

resolve_default_pg_clients

if ! command -v curl >/dev/null 2>&1; then
  log_err "curl nao disponivel para healthcheck do backend"
  exit 1
fi

case "$RESTORE_MODE" in
  restore-only|drop-and-restore) ;;
  *)
    log_err "RESTORE_MODE invalido: $RESTORE_MODE"
    exit 1
    ;;
esac

backup_name="$(basename "$BACKUP_FILE")"
if [ "$backup_name" != "$BACKUP_FILE" ]; then
  log_err "nome de arquivo invalido"
  exit 1
fi

if ! echo "$backup_name" | grep -Eq '^[a-zA-Z0-9._-]+$'; then
  log_err "nome de arquivo invalido"
  exit 1
fi

if [ ! -d "$BACKUPS_DIR" ]; then
  log_err "diretorio de backups nao encontrado: $BACKUPS_DIR"
  exit 1
fi

backups_dir_real="$(cd "$BACKUPS_DIR" && pwd)"
backup_path_real="${backups_dir_real}/${backup_name}"

if [ ! -f "$backup_path_real" ]; then
  log_err "backup nao encontrado: $backup_name"
  exit 1
fi

if [ ! -s "$backup_path_real" ]; then
  log_err "arquivo de backup vazio ou invalido: $backup_name"
  exit 1
fi

if [ -n "$TARGET_RELEASE_TAG" ]; then
  log "target release tag recebido ($TARGET_RELEASE_TAG); parametro ignorado no restore native"
fi

ext="$(printf '%s' "${backup_name##*.}" | tr '[:upper:]' '[:lower:]')"
case "$ext" in
  sql|dump|backup) ;;
  *)
    log_err "extensao nao suportada: .$ext"
    exit 1
    ;;
esac

if [ "$ext" = "dump" ] || [ "$ext" = "backup" ]; then
  log "validando dump e selecionando cliente PostgreSQL compativel"
  if ! select_pg_restore_binary_for_dump "$backup_path_real"; then
    exit 1
  fi
fi

if [ -z "$PG_DUMP_BIN" ] || [ -z "$PSQL_BIN" ]; then
  log_err "cliente PostgreSQL nao disponivel (pg_dump/psql)"
  exit 1
fi

cd "$PROJECT_ROOT"

db_args=(
  "--host=${DB_HOST}"
  "--port=${DB_PORT}"
  "--username=${DB_USER}"
  "--dbname=${DB_NAME}"
)

backend_proc="$(pm2 jlist | grep -oP '"name":"[^"]*backend[^"]*"' | head -1 | cut -d'"' -f4 || true)"
if [ -n "$backend_proc" ]; then
  log "parando backend no PM2: $backend_proc"
  pm2 stop "$backend_proc"
  backend_was_stopped="true"
else
  log "processo backend no PM2 nao encontrado (seguindo sem stop explicito)"
fi

safety_file="${backups_dir_real}/safety_pre_restore_$(date +%Y%m%d_%H%M%S).dump"
log "criando backup de seguranca antes do restore: $(basename "$safety_file")"
PGPASSWORD="$DB_PASSWORD" "$PG_DUMP_BIN" "${db_args[@]}" --format=custom > "$safety_file"

case "$ext" in
  sql)
    log "restaurando arquivo SQL via psql"
    if [ "$RESTORE_MODE" = "drop-and-restore" ]; then
      log "modo drop-and-restore: resetando schema public"
      PGPASSWORD="$DB_PASSWORD" "$PSQL_BIN" "${db_args[@]}" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
    fi
    PGPASSWORD="$DB_PASSWORD" "$PSQL_BIN" "${db_args[@]}" -v ON_ERROR_STOP=1 < "$backup_path_real"
    ;;
  dump|backup)
    log "restaurando arquivo dump via pg_restore"
    if [ "$RESTORE_MODE" = "drop-and-restore" ]; then
      PGPASSWORD="$DB_PASSWORD" "$PG_RESTORE_BIN" -v --clean --if-exists --no-owner --no-acl "${db_args[@]}" "$backup_path_real"
    else
      PGPASSWORD="$DB_PASSWORD" "$PG_RESTORE_BIN" -v --no-owner --no-acl "${db_args[@]}" "$backup_path_real"
    fi
    ;;
esac

if [ -n "$backend_proc" ]; then
  log "reiniciando backend no PM2: $backend_proc"
  pm2 restart "$backend_proc"
else
  log "subindo backend no PM2 com nome padrao multitenant-backend"
  pm2 start apps/backend/dist/main.js --name "multitenant-backend" --cwd "$PROJECT_ROOT/apps/backend"
fi
backend_restarted="true"
pm2 save >/dev/null 2>&1 || true

wait_for_backend_healthy "$HEALTH_TIMEOUT"

if [ "$RUN_MIGRATIONS" = "true" ]; then
  if ! command -v pnpm >/dev/null 2>&1; then
    log_err "pnpm nao disponivel para executar migrate pos-restore"
    exit 1
  fi

  if [ -z "$DATABASE_URL" ]; then
    log_err "DATABASE_URL nao definida para migrate pos-restore"
    exit 1
  fi

  log "executando migrate pos-restore"
  (
    cd "$PROJECT_ROOT/apps/backend"
    export DATABASE_URL
    pnpm exec prisma migrate deploy --schema prisma/schema.prisma
  )
fi

trap - ERR
log "restore nativo concluido com sucesso"
