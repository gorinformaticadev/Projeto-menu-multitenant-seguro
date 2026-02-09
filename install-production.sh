```bash
#!/bin/bash
# install-production.sh — Versão FUNCIONAL para sua VPS

set -e
set -x   # <-- IMPORTANTE: mostra tudo o que está acontecendo

DOMAIN="$1"
EMAIL="$2"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Uso: ./install-production.sh <dominio> <email>"
  exit 1
fi

echo "========================================"
echo "INSTALAÇÃO MULTITENANT — NGINX"
echo "Domínio: $DOMAIN"
echo "Email: $EMAIL"
echo "========================================"

# ======= GARANTIR QUE NGINX TENHA ONDE ESCREVER =======
sudo mkdir -p /etc/nginx/conf.d
sudo mkdir -p /etc/nginx/certs/$DOMAIN

# ======= DETECTAR DOCKER COMPOSE =======
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Erro: Docker Compose não encontrado."
  exit 1
fi

# ======= GARANTIR .ENV =======
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
  echo ".env já existe — mantendo configuração."
fi

# ======= GERAR DOCKER COMPOSE =======
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

# ======= GERAR CONFIGURAÇÃO DO NGINX (CORRETA) =======
NGINX_CONF="/etc/nginx/conf.d/${DOMAIN}.conf"

cat > "/tmp/${DOMAIN}.conf" <<EOF
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

# ======= APLICAR NGINX =======
sudo cp "/tmp/${DOMAIN}.conf" "$NGINX_CONF"

if ! sudo nginx -t; then
  echo "ERRO: Nginx inválido. Abortando."
  exit 1
fi

sudo systemctl reload nginx
echo "NGINX CONFIGURADO!"

# ======= SUBIR DOCKER =======
echo "Subindo containers..."
$COMPOSE -f docker-compose.prod.yml up -d --build

sleep 10

echo "Rodando migrations..."
$COMPOSE -f docker-compose.prod.yml exec -T backend \
  npx prisma migrate deploy || true

echo "INSTALAÇÃO FINALIZADA!"
echo "Acesse: https://${DOMAIN}"
```
