#!/bin/bash
# install-production.sh — Produção com NGINX automático + rollback seguro

set -e

DOMAIN="$1"
EMAIL="$2"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Uso: ./install-production.sh <dominio> <email>"
  exit 1
fi

echo "========================================"
echo "INSTALAÇÃO MULTITENANT — NGINX AUTOMÁTICO"
echo "Domínio: $DOMAIN"
echo "Email: $EMAIL"
echo "========================================"

# ----------- Detectar Docker Compose -----------
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Erro: Docker Compose não encontrado."
  exit 1
fi

# ----------- Garantir .env -----------
if [ ! -f .env ]; then
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
  echo ".env já existe — preservando configuração."
fi

# ----------- Gerar docker-compose (SEM Caddy) -----------
cat > docker-compose.prod.yml <<EOF
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: ./apps/frontend/Dockerfile
    container_name: multitenant-frontend-prod
    restart: unless-stopped
    expose:
      - "5000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
      - PORT=5000
    networks:
      - app-network

  backend:
    build:
      context: .
      dockerfile: ./apps/backend/Dockerfile
    container_name: multitenant-backend-prod
    restart: unless-stopped
    expose:
      - "4000"
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - JWT_SECRET=\${JWT_SECRET}
      - FRONTEND_URL=https://${DOMAIN}
      - NODE_ENV=production
      - PORT=4000
    volumes:
      - uploads:/app/uploads
    networks:
      - app-network

  db:
    image: postgres:15-alpine
    container_name: multitenant-db-prod
    restart: unless-stopped
    environment:
      - POSTGRES_USER=\${POSTGRES_USER}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=\${POSTGRES_DB}
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    container_name: multitenant-redis-prod
    restart: unless-stopped
    volumes:
      - redis_data_prod:/data
    networks:
      - app-network

volumes:
  postgres_data_prod:
  redis_data_prod:
  uploads:

networks:
  app-network:
    driver: bridge
EOF

# ----------- Gerar configuração NGINX -----------
NGINX_CONF="nginx-${DOMAIN}.conf"

cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate /etc/nginx/certs/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/${DOMAIN}/privkey.pem;

    location /api {
        proxy_pass http://multitenant-backend-prod:4000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://multitenant-frontend-prod:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# ----------- Rollback seguro de Nginx -----------
if command -v nginx >/dev/null 2>&1; then

  echo "Aplicando configuração automática no Nginx..."

  BACKUP="/etc/nginx/sites-available/${DOMAIN}.bak.$(date +%s)"

  if [ -f "/etc/nginx/sites-available/${DOMAIN}.conf" ]; then
    sudo cp "/etc/nginx/sites-available/${DOMAIN}.conf" "$BACKUP"
    echo "Backup salvo em: $BACKUP"
  fi

  sudo cp "$NGINX_CONF" "/etc/nginx/sites-available/${DOMAIN}.conf"
  sudo ln -sf "/etc/nginx/sites-available/${DOMAIN}.conf" \
               "/etc/nginx/sites-enabled/${DOMAIN}.conf"

  if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "Nginx atualizado com sucesso."
  else
    echo "ERRO: nova configuração inválida — restaurando backup..."
    sudo cp "$BACKUP" "/etc/nginx/sites-available/${DOMAIN}.conf"
    sudo systemctl reload nginx
    exit 1
  fi

else
  echo "Nginx não encontrado no host — pulei configuração automática."
fi

# ----------- Subir containers -----------
echo "Subindo containers..."
$COMPOSE -f docker-compose.prod.yml up -d --build

sleep 10

echo "Rodando migrations..."
$COMPOSE -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy || true

echo "========================================"
echo "INSTALAÇÃO CONCLUÍDA"
echo "Acesse: https://${DOMAIN}"
echo "API: https://${DOMAIN}/api"
echo "========================================"
