#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="__PROJECT_DIR__"

if [[ -z "$PROJECT_DIR" ]]; then
  echo "[pluggor-update] ERRO: PROJECT_DIR nao foi configurado no wrapper." >&2
  exit 10
fi

cd "$PROJECT_DIR"

if [[ ! -f "install/install.sh" ]]; then
  echo "[pluggor-update] ERRO: install/install.sh nao encontrado em $PROJECT_DIR" >&2
  exit 11
fi

exec bash install/install.sh update --no-prompt
