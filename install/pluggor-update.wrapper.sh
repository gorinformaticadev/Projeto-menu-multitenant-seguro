#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="__PROJECT_DIR__"
APP_USER="__APP_USER__"

if [[ "$PROJECT_DIR" == "__PROJECT_DIR__" ]] || [[ -z "$PROJECT_DIR" ]]; then
  echo "[pluggor-update] ERRO: PROJECT_DIR nao foi configurado no wrapper." >&2
  exit 10
fi

if [[ "$APP_USER" == "__APP_USER__" ]] || [[ -z "$APP_USER" ]]; then
  echo "[pluggor-update] ERRO: APP_USER nao foi configurado no wrapper." >&2
  exit 11
fi

cd "$PROJECT_DIR"

if [[ ! -f "install/install.sh" ]]; then
  echo "[pluggor-update] ERRO: install/install.sh nao encontrado em $PROJECT_DIR" >&2
  exit 12
fi

echo "[UPDATE] Iniciando git pull em $PROJECT_DIR"
sudo -u "$APP_USER" git pull

echo "[UPDATE] Iniciando install/install.sh update"
exec bash install/install.sh update --no-prompt
