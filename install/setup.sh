#!/bin/bash

# ===============================
# Instalador - Projeto Multitenant
# ===============================

set -e # Aborta em caso de erro

show_usage() {
    echo -e "Uso:\n\n  sudo bash setup.sh <domain> <email>\n"
    echo -e "Exemplo:\n\n  sudo bash setup.sh crm.exemplo.com.br admin@exemplo.com\n"
}

echored() {
    echo -ne "\033[41m\033[37m\033[1m  $1  \033[0m\n"
}

echoblue() {
    echo -ne "\033[44m\033[37m\033[1m  $1  \033[0m\n"
}

# Verifica root
if [[ $EUID -ne 0 ]]; then
    echored "O script precisa ser executado como root."
    exit 1
fi

# Parâmetros
if [ -z "$2" ]; then
    show_usage
    exit 1
fi

DOMAIN="$1"
EMAIL="$2"

# Valida email
emailregex="^[a-z0-9!#\$%&'*+/=?^_\`{|}~-]+(\.[a-z0-9!#\$%&'*+/=?^_\`{|}~-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?\$"
if ! [[ $EMAIL =~ $emailregex ]]; then
    echored "Email inválido!"
    exit 1
fi

echoblue "Iniciando instalação do Projeto Multitenant para $DOMAIN"

# Detecta diretório base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"

# Instala Docker se necessário
if ! command -v docker &> /dev/null; then
    echoblue "Instalando Docker..."
    apt-get update -qq
    apt-get install -y ca-certificates curl gnupg lsb-release
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin
fi

# Gera segredos dinâmicos
DB_USER="user_$(openssl rand -hex 4)"
DB_PASSWORD="$(openssl rand -hex 16)"
DB_NAME="db_$(openssl rand -hex 4)"
JWT_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(openssl rand -hex 16)"

# Configura .env
echoblue "Configurando variáveis de ambiente..."
if [ ! -f ".env.example" ]; then
    echored "Erro: .env.example não encontrado em $BASE_DIR"
    exit 1
fi

cp .env.example .env
sed -i \
    -e "s/__DOMAIN__/${DOMAIN}/g" \
    -e "s/__EMAIL__/${EMAIL}/g" \
    -e "s/__DB_USER__/${DB_USER}/g" \
    -e "s/__DB_PASSWORD__/${DB_PASSWORD}/g" \
    -e "s/__DB_NAME__/${DB_NAME}/g" \
    -e "s/__JWT_SECRET__/${JWT_SECRET}/g" \
    -e "s/__ENCRYPTION_KEY__/${ENCRYPTION_KEY}/g" \
    .env

echo "" >> .env
echo "# Generated Database URL" >> .env
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public" >> .env

# ===============================
# Ajusta o docker-compose.yml (Contexto e Env)
# ===============================
echoblue "Ajustando Docker Compose..."
sed -i 's/context: .\/apps\/backend/context: ./g' docker-compose.yml
sed -i 's/dockerfile: Dockerfile/dockerfile: apps\/backend\/Dockerfile/g' docker-compose.yml
sed -i 's/context: .\/apps\/frontend/context: ./g' docker-compose.yml
sed -i 's/dockerfile: Dockerfile/dockerfile: apps\/frontend\/Dockerfile/g' docker-compose.yml

if ! grep -q "env_file:" docker-compose.yml; then
    sed -i '/container_name: app-backend/a \    env_file:\n      - .env' docker-compose.yml
fi

# ===============================
# Ajusta o prisma.config.js (Versão Protegida)
# ===============================
echoblue "Configurando Prisma Config..."

# Usar 'EOF' entre aspas simples impede que o bash tente injetar variáveis
# e garante que o arquivo final seja puro JavaScript
cat > apps/backend/prisma.config.js << 'EOF'
module.exports = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};
EOF

# ===============================
# Corrige o schema.prisma
# ===============================
SCHEMA_FILE="apps/backend/prisma/schema.prisma"
if [ -f "$SCHEMA_FILE" ]; then
    echoblue "Ajustando schema.prisma..."
    sed -i '/url *=/d' "$SCHEMA_FILE"
    sed -i '/provider = "postgresql"/a \  url = env("DATABASE_URL")' "$SCHEMA_FILE"
fi

# ===============================
# Substitui SUPER_ADMIN no seed.ts
# ===============================
SEED_FILE="apps/backend/prisma/seed.ts"
if [ -f "$SEED_FILE" ]; then
    sed -i "s/'admin@system.com'/'$EMAIL'/g" "$SEED_FILE"
fi

# ===============================
# Configura Nginx (Somente se instalado)
# ===============================
if command -v nginx &> /dev/null; then
    echoblue "Configurando Nginx local..."
    NGINX_FILE="/etc/nginx/sites-available/multitenant.conf"
    cat > "$NGINX_FILE" << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
    ln -sf "$NGINX_FILE" /etc/nginx/sites-enabled/multitenant.conf
    nginx -t && systemctl reload nginx || echo "Falha ao recarregar Nginx."
fi

# Sobe os serviços
echoblue "Construindo containers..."
docker compose build --no-cache
docker compose up -d db

echoblue "Aguardando banco de dados..."
sleep 15

# Migrações e Seed
echoblue "Executando migrações..."
DB_URL_VAL="postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public"

docker compose run --rm -e DATABASE_URL="$DB_URL_VAL" backend npx prisma migrate deploy --config prisma.config.js
docker compose run --rm -e DATABASE_URL="$DB_URL_VAL" backend npx prisma db seed --config prisma.config.js

# Sobe tudo finalizado
echoblue "Finalizando inicialização..."
docker compose up -d

# ===============================
# Exibe credenciais geradas
# ===============================
echoblue "Instalação concluída com sucesso!"
echo "-------------------------------------------------"
echo "URL: https://${DOMAIN}"
echo "Admin: ${EMAIL}"
echo "DB_NAME: $DB_NAME"
echo "DB_USER: $DB_USER"
echo "DB_PASSWORD: $DB_PASSWORD"
echo "JWT_SECRET: $JWT_SECRET"
echo "ENCRYPTION_KEY: $ENCRYPTION_KEY"
echo "-------------------------------------------------"
echo ""
echo "A aplicação estará disponível em: https://${DOMAIN}"
echo "Login padrão: ${EMAIL} / senha: 123456 (alterável após primeiro acesso)"