```bash
#!/bin/bash
# install-production.sh — versão ROBUSTA (visível + logada)

LOG="/root/install-multitenant.log"

# Força log e saída na tela ao mesmo tempo
exec > >(tee -a "$LOG") 2>&1

echo "==============================="
echo "INÍCIO DA INSTALAÇÃO"
echo "Data: $(date)"
echo "Usuário: $(whoami)"
echo "PWD: $(pwd)"
echo "==============================="

set -e

DOMAIN="$1"
EMAIL="$2"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "ERRO: parâmetros ausentes."
  echo "Uso: ./install-production.sh <dominio> <email>"
  exit 1
fi

echo "Domínio recebido: $DOMAIN"
echo "Email recebido: $EMAIL"

# ---------- Garantir diretórios reais do Nginx ----------
echo "Garantindo diretórios do Nginx..."
sudo mkdir -p /etc/nginx/conf.d
sudo mkdir -p /etc/nginx/certs/$DOMAIN

# ---------- Detectar Docker Compose ----------
echo "Detectando Docker Compose..."
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERRO: Docker Compose não encontrado."
  exit 1
fi
echo "Usando: $COMPOSE"

# ---------- Garantir .env ----------
echo "Verificando .env..."
if [ ! -f .env ]; then
  echo "Criando novo .env..."
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
  echo ".env já existe — preservando."
fi

# ---------- Gerar docker-compose.prod.yml ----------
echo "Gerando docker-compose.prod.yml..."
cat > docker-compose.prod.yml <<EOF
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

# ---------- Gerar config REAL do Nginx ----------
NGINX_CONF="/etc/nginx/conf.d/${DOMAIN}.conf"

echo "Criando config do Nginx em $NGINX_CONF"
cat > "$NGINX_CONF" <<EOF
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
    }

    location / {
        proxy_pass http://multitenant-frontend-prod:5000;
    }
}
EOF

echo "Testando Nginx..."
if ! sudo nginx -t; then
  echo "ERRO: configuração do Nginx inválida."
  exit 1
fi

echo "Recarregando Nginx..."
sudo systemctl reload nginx

# ---------- Subir containers ----------
echo "Subindo containers..."
$COMPOSE -f docker-compose.prod.yml up -d --build

echo "Aguardando containers..."
sleep 15

echo "Rodando migrations (se backend subir)..."
$COMPOSE -f docker-compose.prod.yml exec -T backend \
  npx prisma migrate deploy || echo "⚠️ Migrations falharam — verificar backend."

echo "==============================="
echo "INSTALAÇÃO FINALIZADA"
echo "Acesse: https://${DOMAIN}"
echo "Log completo em: $LOG"
echo "==============================="
```
