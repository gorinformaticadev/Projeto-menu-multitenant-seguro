#!/bin/bash
# update-production.sh — Atualização segura de produção

set -e

echo "=== ATUALIZAÇÃO DE PRODUÇÃO ==="

if [ ! -f .env ]; then
  echo "Erro: .env não encontrado. Você nunca instalou este ambiente."
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "Erro: não é um repositório Git válido."
  exit 1
fi

# Escolher compose
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

# 1) Atualizar código SEM apagar nada
echo "Atualizando repositório..."
git pull origin main

# 2) Atualizar imagens
echo "Atualizando imagens Docker..."
$COMPOSE -f docker-compose.prod.yml pull

# 3) Recriar containers sem perder volumes
echo "Recriando stack..."
$COMPOSE -f docker-compose.prod.yml up -d --build

# 4) Rodar migrations (sempre)
echo "Aplicando migrations..."
$COMPOSE -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy || true

echo "ATUALIZAÇÃO CONCLUÍDA."
