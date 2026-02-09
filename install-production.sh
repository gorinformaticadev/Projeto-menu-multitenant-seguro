#!/bin/bash
# install-production.sh — Instalação inicial segura

set -e

DOMAIN="$1"
EMAIL="$2"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Uso: ./install-production.sh <dominio> <email>"
  exit 1
fi

echo "=== INSTALAÇÃO INICIAL EM PRODUÇÃO ==="
echo "Domínio: $DOMAIN"
echo "Email: $EMAIL"

# 1) Verificar Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: Docker não instalado."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Erro: Docker Compose não encontrado."
  exit 1
fi

# 2) Garantir .env (NÃO sobrescreve se já existir)
if [ ! -f .env ]; then
  echo "Gerando .env inicial..."
  cat > .env <<EOF
DOMAIN=$DOMAIN
NODE_ENV=production
POSTGRES_USER=multitenant_user
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr '+/' '_-' | tr -d '=')
POSTGRES_DB=multitenant_db
DATABASE_URL=postgresql://multitenant_user:\${POSTGRES_PASSWORD}@db:5432/multitenant_db?schema=public
JWT_SECRET=$(openssl rand -base64 64 | tr '+/' '_-' | tr -d '=')
FRONTEND_URL=https://$DOMAIN
EOF
else
  echo ".env já existe — preservando configuração atual."
fi

# 3) Subir stack completa
echo "Subindo containers..."
$COMPOSE -f docker-compose.prod.yml up -d --build

# 4) Aguardar banco
echo "Aguardando PostgreSQL..."
sleep 12

# 5) Rodar migrations (idempotente)
echo "Executando migrations..."
$COMPOSE -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy || true

echo "INSTALAÇÃO CONCLUÍDA."
echo "Acesse: https://$DOMAIN"
