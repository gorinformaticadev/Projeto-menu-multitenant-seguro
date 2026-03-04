#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${BACKUP_FILE:-}"
BACKEND_INTERNAL_URL="${BACKEND_INTERNAL_URL:-http://127.0.0.1:4000/api}"
BACKUP_INTERNAL_API_TOKEN="${BACKUP_INTERNAL_API_TOKEN:-}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-false}"
RESTORE_REASON="${RESTORE_REASON:-restore via wrapper script}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-5}"
POLL_TIMEOUT_SECONDS="${POLL_TIMEOUT_SECONDS:-7200}"

log() {
  echo "[restore-wrapper-native] $*"
}

log_err() {
  echo "[restore-wrapper-native] ERROR: $*" >&2
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_err "comando obrigatorio nao encontrado: $1"
    exit 1
  fi
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

extract_json_string() {
  local key="$1"
  sed -n "s/.*\"${key}\":\"\([^\"]*\)\".*/\1/p" | head -n 1
}

extract_json_number() {
  local key="$1"
  sed -n "s/.*\"${key}\":\([0-9][0-9]*\).*/\1/p" | head -n 1
}

normalize_bool() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|on) echo "true" ;;
    *) echo "false" ;;
  esac
}

require_cmd curl

if [ -z "$BACKUP_FILE" ]; then
  log_err "BACKUP_FILE nao informado"
  exit 1
fi

if [ -z "$BACKUP_INTERNAL_API_TOKEN" ]; then
  log_err "BACKUP_INTERNAL_API_TOKEN nao informado"
  exit 1
fi

backup_name="$(basename "$BACKUP_FILE")"
if [ "$backup_name" != "$BACKUP_FILE" ]; then
  log_err "BACKUP_FILE deve conter apenas nome de arquivo (sem caminho)"
  exit 1
fi

if ! printf '%s' "$backup_name" | grep -Eq '^[a-zA-Z0-9._-]+$'; then
  log_err "nome de backup invalido: $backup_name"
  exit 1
fi

run_migrations_bool="$(normalize_bool "$RUN_MIGRATIONS")"
reason_escaped="$(json_escape "$RESTORE_REASON")"
backup_escaped="$(json_escape "$backup_name")"

payload="{\"backupFile\":\"${backup_escaped}\",\"runMigrations\":${run_migrations_bool},\"reason\":\"${reason_escaped}\"}"

log "iniciando job de restore via API interna"
create_response="$(curl -sS -X POST "${BACKEND_INTERNAL_URL}/backups/internal/restore-by-file" \
  -H "Content-Type: application/json" \
  -H "x-backup-internal-token: ${BACKUP_INTERNAL_API_TOKEN}" \
  --data "$payload")"

if ! printf '%s' "$create_response" | grep -q '"success":true'; then
  log_err "falha ao criar job de restore"
  log_err "$create_response"
  exit 1
fi

job_id="$(printf '%s' "$create_response" | extract_json_string "jobId")"
if [ -z "$job_id" ]; then
  log_err "nao foi possivel extrair jobId da resposta"
  log_err "$create_response"
  exit 1
fi

log "job enfileirado: $job_id"

start_ts="$(date +%s)"
last_status=""

while true; do
  status_response="$(curl -sS "${BACKEND_INTERNAL_URL}/backups/internal/jobs/${job_id}" \
    -H "x-backup-internal-token: ${BACKUP_INTERNAL_API_TOKEN}")"

  if ! printf '%s' "$status_response" | grep -q '"success":true'; then
    log_err "falha ao consultar status do job ${job_id}"
    log_err "$status_response"
    exit 1
  fi

  status="$(printf '%s' "$status_response" | extract_json_string "status")"
  step="$(printf '%s' "$status_response" | extract_json_string "currentStep")"
  progress="$(printf '%s' "$status_response" | extract_json_number "progressPercent")"
  error_message="$(printf '%s' "$status_response" | extract_json_string "error")"

  if [ "$status" != "$last_status" ] || [ -n "$step" ]; then
    log "job=${job_id} status=${status:-unknown} step=${step:-n/a} progress=${progress:-0}%"
    last_status="$status"
  fi

  case "$status" in
    SUCCESS)
      log "restore finalizado com sucesso"
      exit 0
      ;;
    FAILED|CANCELED)
      log_err "restore finalizado com falha (status=${status})"
      if [ -n "$error_message" ]; then
        log_err "erro: $error_message"
      fi
      exit 1
      ;;
  esac

  now_ts="$(date +%s)"
  elapsed="$((now_ts - start_ts))"
  if [ "$elapsed" -ge "$POLL_TIMEOUT_SECONDS" ]; then
    log_err "timeout aguardando conclusao do job (${POLL_TIMEOUT_SECONDS}s)"
    exit 1
  fi

  sleep "$POLL_INTERVAL_SECONDS"
done
