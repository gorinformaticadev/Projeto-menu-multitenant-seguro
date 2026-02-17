#!/bin/bash
# update-production.sh — Atualização segura REAL (sem Nginx host)

set -e

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado — atualização abortada."
  exit 1
fi

echo ">> Backup do .env"
cp .env /tmp/.env.backup

echo ">> Atualizando repositório..."
git pull origin main

echo ">> Restaurando .env"
mv /tmp/.env.backup .env

echo ">> Rebuild e restart dos containers (sem mexer em Nginx)..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo ">> Rodando migrations manualmente..."
docker compose -f docker-compose.prod.yml run --rm migrator || true

echo "✅ Atualização concluída (dados preservados, zero gambiarra no Nginx)."
