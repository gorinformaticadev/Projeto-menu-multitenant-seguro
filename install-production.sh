#!/bin/bash
# install-production.sh - Produção com NGINX (dois modos: interno ou externo)
# Autor: Sistema Multitenant Seguro

set -e

# ---------- Cores ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ---------- Padrões ----------
DOMAIN="crm.whapichat.com.br"
EMAIL="admin@whapichat.com.br"
NODE_ENV="production"
MODE="install"          # install | update
PROXY_MODE="internal"   # internal (nginx no docker) | external (nginx do host)

# ---------- Logs ----------
print_header() { echo -e "${CYAN}========================================${NC}\n${CYAN}$1${NC}\n${CYAN}========================================${NC}"; }
print_success() { echo -e "${GREEN}✔ $1${NC}"; }
print_error() { echo -e "${RED}✖ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ $1${NC}"; }

# ---------- Args ----------
while [[ $# -gt 0 ]]; do
  case $1 in
    --update)
      MODE="update"; shift ;;
    --domain)
      DOMAIN="$2"; shift 2 ;;
    --email)
      EMAIL="$2"; shift 2 ;;
    --with-nginx)       # modo padrão (proxy interno)
      PROXY_MODE="internal"; shift ;;
    --external-nginx)   # modo para servidor já ocupado
      PROXY_MODE="external"; shift ;;
    *)
      echo "Uso: ./install-production.sh [--update] [--domain DOMINIO] [--email EMAIL] [--with-nginx | --external-nginx]"
      exit 1 ;;
  esac
done

# ---------- Pré-requisitos ----------
check_prerequisites() {
  print_header "🔍 PRÉ-REQUISITOS"

  if ! command -v docker &>/dev/null; then
    print_error "Docker não encontrado."; exit 1
  fi

  if docker compose version &>/dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
  else
    print_error "Docker Compose não encontrado."; exit 1
  fi

  print_success "Docker/Compose OK"
}

# ---------- .env ----------
generate_env() {
  print_header "🔐 .env"

  if [ -f .env ]; then
    print_info "Usando .env existente"
    set -a; source .env; set +a
    return
  fi

  if [ "$MODE" = "update" ]; then
    print_error "UPDATE sem .env existente"; exit 1
  fi

  DB_PASSWORD=$(openssl rand -base64 32 | tr '+/' '_-' | tr -d '=')
  JWT_SECRET=$(openssl rand -base64 64 | tr '+/' '_-' | tr -d '=')
  ADMIN_PASSWORD=$(openssl rand -base64 24 | tr '+/' '_-' | tr -d '=')

  cat > .env <<EOF
NODE_ENV=production
DOMAIN=$DOMAIN

POSTGRES_USER=multitenant_user
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=multitenant_db
POSTGRES_HOST=db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://multitenant_user:$DB_PASSWORD@db:5432/multitenant_db?schema=public

JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# URLs internas
FRONTEND_URL=https://$DOMAIN
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
API_URL=http://backend:4000

REDIS_HOST=redis
REDIS_PORT=6379
EOF

  echo "Admin inicial: $ADMIN_PASSWORD" > admin_credentials.txt
  print_success ".env gerado"
}

# ---------- Arquivos de NGINX (modo interno) ----------
create_internal_nginx_files() {
  mkdir -p nginx/conf.d nginx/certs

  cat > nginx/conf.d/app.conf <<EOF
server {
  listen 80;
  server_name $DOMAIN;
  return 301 https://\$host\$request_uri;
}

server {
  listen 443 ssl;
  server_name $DOMAIN;

  ssl_certificate /etc/nginx/certs/fullchain.pem;
  ssl_certificate_key /etc/nginx/certs/privkey.pem;

  location / {
    proxy_pass http://frontend:3000;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /api {
    proxy_pass http://backend:3000;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

  print_success "Config Nginx interno criada em nginx/conf.d/app.conf"
}

# ---------- Template para NGINX externo ----------
create_external_nginx_example() {
  cat > nginx-${DOMAIN}-example.conf <<EOF
upstream minha_front {
  server 127.0.0.1:5000;
}

upstream minha_api {
  server 127.0.0.1:4000;
}

server {
  server_name $DOMAIN;

  location / {
    proxy_pass http://minha_front;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /api {
    proxy_pass http://minha_api;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

  print_info "Arquivo exemplo para Nginx do host: nginx-${DOMAIN}-example.conf"
}

# ---------- Compose selection ----------
select_compose() {
  if [ "$PROXY_MODE" = "internal" ]; then
    COMPOSE_FILE="docker-compose.prod.with-nginx.yml"
  else
    COMPOSE_FILE="docker-compose.prod.external.yml"
  fi
}

# ---------- Deploy ----------
deploy() {
  print_header "🚀 DEPLOY ($MODE | proxy=$PROXY_MODE)"

  if [ "$MODE" = "update" ]; then
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" up --build -d --remove-orphans
  else
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" up --build -d
  fi
}

# ---------- Migrations ----------
run_migrations() {
  print_header "🌱 MIGRATIONS"
  sleep 10
  $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy
  if [ "$MODE" = "install" ]; then
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" exec -T backend npx ts-node prisma/seed.ts || true
  fi
}

# ---------- Main ----------
main() {
  print_header "INSTALL-PRODUCTION: $DOMAIN"

  check_prerequisites
  generate_env
  select_compose

  if [ "$PROXY_MODE" = "internal" ]; then
    create_internal_nginx_files
  else
    create_external_nginx_example
  fi

  deploy
  run_migrations

  print_header "🎉 CONCLUÍDO"
  echo "URL: https://$DOMAIN"
  echo "Modo: $PROXY_MODE"
  if [ -f admin_credentials.txt ]; then
    echo "Credenciais em admin_credentials.txt"
  fi
}

main
