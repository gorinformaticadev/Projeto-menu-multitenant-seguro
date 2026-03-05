#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
NEW_UPLOADS="${UPLOADS_DIR:-/app/uploads}"
OLD_UPLOADS="${OLD_UPLOADS_DIR:-/app/apps/backend/uploads}"

# Fallback para instalacao nativa.
if [[ "$NEW_UPLOADS" == "/app/uploads" && ! -d "/app" ]]; then
  NEW_UPLOADS="${PROJECT_ROOT}/uploads"
fi
if [[ "$OLD_UPLOADS" == "/app/apps/backend/uploads" && ! -d "/app/apps/backend" ]]; then
  OLD_UPLOADS="${PROJECT_ROOT}/apps/backend/uploads"
fi

MARKER_FILE="${NEW_UPLOADS}/.migration_from_old_done"

log() {
  echo "[migrate-uploads] $*"
}

if [[ -f "$MARKER_FILE" ]]; then
  log "marker encontrado ($MARKER_FILE). Migracao ja concluida anteriormente."
  exit 0
fi

mkdir -p "$NEW_UPLOADS"
log "NEW_UPLOADS=$NEW_UPLOADS"
log "OLD_UPLOADS=$OLD_UPLOADS"

if [[ ! -d "$OLD_UPLOADS" ]]; then
  log "diretorio antigo nao encontrado. Nada para migrar."
  touch "$MARKER_FILE"
  exit 0
fi

if [[ -z "$(find "$OLD_UPLOADS" -mindepth 1 -print -quit 2>/dev/null || true)" ]]; then
  log "diretorio antigo existe, mas esta vazio. Nada para migrar."
  touch "$MARKER_FILE"
  exit 0
fi

if command -v rsync >/dev/null 2>&1; then
  log "sincronizando arquivos com rsync --ignore-existing"
  rsync -a --ignore-existing "$OLD_UPLOADS"/ "$NEW_UPLOADS"/
else
  log "rsync nao encontrado. Usando fallback cp -a -n"
  cp -a -n "$OLD_UPLOADS"/. "$NEW_UPLOADS"/
fi

touch "$MARKER_FILE"
log "migracao concluida com sucesso. OLD_UPLOADS preservado."
