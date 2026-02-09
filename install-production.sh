#!/bin/bash
# install-production.sh - Instalação e Atualização para Produção
# Autor: Sistema Multitenant Seguro
# Descrição: Script de instalação/atualização automatizada via Docker com HTTPS automático (Caddy)

set -e  # Abortar em caso de erro

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variáveis Padrão
DOMAIN="crm.whapichat.com.br"
EMAIL="admin@whapichat.com.br" # Necessário para o Let's Encrypt
NODE_ENV="production"
MODE="install" # install ou update

# Funções de Log
print_header() { echo -e "${CYAN}========================================${NC}\n${CYAN}$1${NC}\n${CYAN}========================================${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

# Argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --update)
            MODE="update"
            shift
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        *)
            echo "Opção desconhecida: $1"
            echo "Uso: ./install-production.sh [--update] [--domain crm.whapichat.com.br] [--email admin@...]"
            exit 1
            ;;
    esac
done

check_prerequisites() {
    print_header "🔍 VERIFICANDO PRÉ-REQUISITOS"
    if ! command -v docker &> /dev/null; then
        print_error "Docker não encontrado. Instale o Docker primeiro."
        exit 1
    fi
    # Tenta docker compose v2 ou v1
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        print_error "Docker Compose não encontrado."
        exit 1
    fi
    print_success "Docker e Compose encontrados."
}

generate_env() {
    print_header "🔐 CONFIGURAÇÃO DO AMBIENTE (.env)"
    
    if [ -f .env ]; then
        print_info "Arquivo .env existente encontrado. Mantendo configurações atuais."
        # Carregar variáveis existentes para uso no script se necessário
        export $(grep -v '^#' .env | xargs)
    else
        if [ "$MODE" == "update" ]; then
            print_error "Modo UPDATE selecionado mas .env não encontrado. Execute a instalação primeiro."
            exit 1
        fi
        
        print_info "Gerando novo arquivo .env..."
        
        # Gerar senhas
        DB_PASSWORD=$(openssl rand -base64 32)
        JWT_SECRET=$(openssl rand -base64 64)
        ADMIN_PASSWORD=$(openssl rand -base64 24 | tr '+/' '_-')
        
        cat > .env << EOF
# ============================================
# CONFIGURAÇÕES DE PRODUÇÃO ($DOMAIN)
# ============================================
NODE_ENV=production
DOMAIN=$DOMAIN

# Banco de Dados
POSTGRES_USER=multitenant_user
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=multitenant_db
POSTGRES_HOST=db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://multitenant_user:$DB_PASSWORD@db:5432/multitenant_db?schema=public

# Segurança
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# URLs (Internas e Externas)
FRONTEND_URL=https://$DOMAIN
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
API_URL=http://backend:4000

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
EOF
        print_success "Arquivo .env gerado com sucesso!"
        echo "Senha Admin Gerada: $ADMIN_PASSWORD" > admin_credentials.txt
        print_info "Credenciais de admin salvas em admin_credentials.txt (guarde com segurança!)"
    fi
}

create_caddyfile() {
    print_header "🌐 CONFIGURANDO PROXY REVERSO (Caddy)"
    
    cat > Caddyfile <<EOF
${DOMAIN} {
    # Compressão Gzip/Zstd
    encode gzip zstd

    # Security Headers básicos
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-XSS-Protection "1; mode=block"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
    }

    # Rota API -> Backend
    handle_path /api/* {
        reverse_proxy backend:4000 {
            header_up Host {host}
            header_up X-Real-IP {remote}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Rota Health -> Backend Health
    handle /health {
        reverse_proxy backend:4000
    }

    # Default -> Frontend
    handle {
        reverse_proxy frontend:5000 {
            header_up Host {host}
            header_up X-Real-IP {remote}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Logs
    log {
        output file /data/access.log
    }
}
EOF
    print_success "Caddyfile gerado para $DOMAIN"
}

create_docker_compose() {
    print_header "🐳 GERANDO DOCKER COMPOSE (PRODUÇÃO)"
    
    cat > docker-compose.prod.yml <<EOF
version: '3.8'

services:
  # Caddy (Reverse Proxy & SSL Automático)
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend
      - backend
    networks:
      - app-network

  # Frontend (Next.js)
  frontend:
    build: 
      context: .
      dockerfile: ./apps/frontend/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://${DOMAIN}/api
    container_name: multitenant-frontend-prod
    restart: unless-stopped
    expose:
      - "5000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
      - PORT=5000
    depends_on:
      - backend
    networks:
      - app-network

  # Backend (Node.js/NestJS)
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
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads
    networks:
      - app-network

  # Database (PostgreSQL)
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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Cache (Redis)
  redis:
    image: redis:7-alpine
    container_name: multitenant-redis-prod
    restart: unless-stopped
    volumes:
      - redis_data_prod:/data
    networks:
      - app-network

volumes:
  caddy_data:
  caddy_config:
  postgres_data_prod:
  redis_data_prod:

networks:
  app-network:
    driver: bridge
EOF
    print_success "docker-compose.prod.yml gerado."
}

deploy() {
    print_header "🚀 INICIANDO DEPLOY ($MODE)"
    
    if [ "$MODE" == "update" ]; then
        print_info "Atualizando imagens e recriando containers..."
        $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml up --build -d --remove-orphans
    else
        print_info "Iniciando containers pela primeira vez..."
        $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml up --build -d
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Containers iniciados!"
    else
        print_error "Falha ao iniciar containers."
        exit 1
    fi
}

run_migrations() {
    print_header "🌱 BANCO DE DADOS"
    
    print_info "Aguardando banco de dados..."
    sleep 10
    
    print_info "Rodando migrations..."
    $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
    
    if [ "$MODE" == "install" ]; then
        print_info "Rodando seed inicial..."
        $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml exec -T backend npx ts-node prisma/seed.ts || echo "Seed pode já ter sido rodado ou falhou sem gravidade."
    fi
    
    print_success "Banco de dados atualizado!"
}

main() {
    print_header "INSTALL-PRODUCTION: $DOMAIN"
    
    check_prerequisites
    generate_env
    create_caddyfile
    create_docker_compose
    deploy
    run_migrations
    
    print_header "🎉 DEPLOY CONCLUÍDO!"
    echo "Acesse: https://$DOMAIN"
    echo "API: https://$DOMAIN/api"
    echo "Modo: $MODE"
    if [ -f admin_credentials.txt ]; then
        echo "Credenciais iniciais (se instalacao nova) em: admin_credentials.txt"
    fi
}

main
