```bash
#!/bin/bash
# install-production.sh —  NGINX PADRÃO

set -e

DOMAIN="$1"
EMAIL="$2"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Uso: ./install-production.sh <dominio> <email>"
  exit 1
fi

echo "========================================"
echo "INSTALAÇÃO MULTITENANT (COMPATÍVEL TICKETZ)"
echo "Domínio: $DOMAIN"
echo "Email: $EMAIL"
echo "========================================"

# -------- Detectar Docker Compose --------
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Erro: Docker Compose não encontrado."
  exit 1
fi

# -------- Garantir .env (não sobrescreve em update) --------
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

# -------- Gerar docker-compose.prod.yml --------
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

# -------- Detectar estrutura real do Nginx --------
echo "Detectando estrutura do Nginx..."

if [ -d "/etc/nginx/conf.d" ]; then
  NGINX_DIR="/etc/nginx/conf.d"
elif [ -d "/etc/nginx/sites-available" ]; then
  NGINX_DIR="/etc/nginx/sites-available"
else
  echo "Nginx não encontrado — instalando padrão mínimo..."
  sudo apt update && sudo apt install -y nginx
  sudo mkdir -p /etc/nginx/conf.d
  NGINX_DIR="/etc/nginx/conf.d"
fi

echo "Usando diretório Nginx: $NGINX_DIR"

# -------- Criar backup seguro --------
BACKUP="/etc/nginx/backup-$(date +%s)"
sudo mkdir -p "$BACKUP"
sudo cp -r /etc/nginx "$BACKUP"

# -------- Gerar config compatível --------
NGINX_CONF="$NGINX_DIR/${DOMAIN}.conf"

cat > /tmp/${DOMAIN}.conf <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    location /api {
        proxy_pass http://multitenant-backend-prod:4000;
    }

    location / {
        proxy_pass http://multitenant-frontend-prod:5000;
    }
}
EOF

sudo cp /tmp/${DOMAIN}.conf "$NGINX_CONF"

echo "Testando Nginx..."
if ! sudo nginx -t; then
  echo "ERRO: configuração inválida — restaurando backup..."
  sudo rm -rf /etc/nginx
  sudo cp -r "$BACKUP" /etc/nginx
  sudo systemctl reload nginx
  exit 1
fi

sudo systemctl reload nginx
echo "Nginx configurado com sucesso."

# -------- Subir containers --------
echo "Subindo containers..."
$COMPOSE -f docker-compose.prod.yml up -d --build

sleep 10

echo "Rodando migrations..."
$COMPOSE -f docker-compose.prod.yml exec -T backend \
  npx prisma migrate deploy || true

echo "========================================"
echo "INSTALAÇÃO CONCLUÍDA"
echo "Acesse: https://${DOMAIN}"
echo "========================================"
```
