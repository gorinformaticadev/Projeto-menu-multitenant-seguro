#!/bin/bash
# update-production.sh — Atualização com REPO NOVO + DADOS PRESERVADOS

set -e

echo "=== ATUALIZAÇÃO DE PRODUÇÃO (REPO NOVO) ==="

# 1) Verificar Docker
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

# 2) Garantir que o ambiente antigo existe
if [ ! -f ../Projeto-menu-multitenant-seguro/.env ] && [ ! -f .env ]; then
  echo "⚠️ ATENÇÃO: .env não encontrado!"
  echo "Se este é um servidor já instalado, você perdeu sua configuração."
  echo "Atualização cancelada."
  exit 1
fi

# 3) Se existir .env antigo fora do repo, copiar para o novo
if [ -f ../Projeto-menu-multitenant-seguro/.env ] && [ ! -f .env ]; then
  echo "Recuperando .env do ambiente anterior..."
  cp ../Projeto-menu-multitenant-seguro/.env .env
fi

# 4) Atualizar imagens e containers SEM apagar volumes
echo "Atualizando containers..."
$COMPOSE -f docker-compose.prod.yml up -d --build

# 5) Rodar migrations (sempre)
echo "Rodando migrations..."
$COMPOSE -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy || true

echo "✅ Atualização concluída com repositório novo e dados preservados."
