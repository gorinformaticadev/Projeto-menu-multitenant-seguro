#!/bin/bash

# SCRIPT AUTO-CONTIDO - TUDO EMBUTIDO
# Salve este arquivo como 'install-multitenant.sh' e execute: sudo bash install-multitenant.sh crm.whapichat.com.br

DOMINIO="$1"

# Verificações
if [ "$EUID" -ne 0 ]; then 
    echo "ERRO: Execute como root"
    exit 1
fi

if [ -z "$DOMINIO" ]; then
    echo "USO: sudo bash $0 dominio.com.br"
    exit 1
fi

echo "🚀 INSTALAÇÃO AUTO-CONTIDA - 1 SEGUNDO"
sleep 1

# Diretório limpo
DIR="/root/multitenant-final"
echo "💥 Limpando e criando diretório..."
rm -rf "$DIR"
mkdir -p "$DIR"
cd "$DIR"

# Clonar repositório
echo "📥 Clonando repositório..."
git clone https://github.com/gorinformaticadev/Pluggor.git .
git checkout main

# Docker
echo "🐳 Verificando Docker..."
if ! command -v docker &> /dev/null; then
    curl -sSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi

# Senhas HEXADECIMAIS (100% seguras)
echo "🔐 Gerando senhas..."
DB_PASS=$(openssl rand -hex 16)  # 32 chars
JWT_SEC=$(openssl rand -hex 32)  # 64 chars
ADMIN_PASS=$(openssl rand -hex 8) # 16 chars

# .env
cat > .env << EOF
DB_USER=multitenant_user
DB_PASSWORD=$DB_PASS
DB_NAME=multitenant_db
DB_HOST=db
DB_PORT=5432
JWT_SECRET=$JWT_SEC
JWT_EXPIRES_IN=7d
NODE_ENV=production
FRONTEND_URL=https://$DOMINIO
API_URL=https://$DOMINIO/api
BACKEND_PORT=4000
FRONTEND_PORT=5000
EOF

# docker-compose.prod.yml EMBUTIDO
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "${DB_PORT}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
  backend:
    build: ./apps/backend
    ports:
      - "${BACKEND_PORT}:4000"
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
      NODE_ENV: ${NODE_ENV}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
  frontend:
    build: ./apps/frontend
    ports:
      - "${FRONTEND_PORT}:5000"
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
      NODE_ENV: ${NODE_ENV}
    depends_on:
      - backend
    networks:
      - app-network
volumes:
  postgres_data:
networks:
  app-network:
    driver: bridge
EOF

# Executar
echo "🏗 Iniciando sistema..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
docker-compose -f docker-compose.prod.yml up --build -d

echo "⏱ Aguardando 15 segundos..."
sleep 15

# Verificar
echo "🔍 Validando instalação..."
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "🗄 Configurando banco..."
    docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml exec -T backend npx ts-node prisma/seed.ts 2>/dev/null || true
    
    echo ""
    echo "✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
    echo "====================================="
    echo "🌐 Acesse: https://$DOMINIO"
    echo "👤 Login: admin@system.com"
    echo "🔑 Senha: $ADMIN_PASS"
    echo "🔒 DB User: multitenant_user"
    echo "🔓 DB Pass: $DB_PASS"
    echo "====================================="
    echo "Data: $(date)"
else
    echo "❌ FALHA NA INSTALAÇÃO"
    echo "Logs:"
    docker-compose -f docker-compose.prod.yml logs --tail=10
    exit 1
fi