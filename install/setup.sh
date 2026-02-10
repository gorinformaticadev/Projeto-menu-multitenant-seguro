#!/bin/bash

# ===============================
# Instalador - Projeto Multitenant
# ===============================

show_usage() {
    echo -e "Uso:\n\n  sudo bash setup.sh [-b <branch>] <domain> <email>\n"
    echo -e "Exemplo:\n\n  sudo bash setup.sh -b main crm.gorinformatica.com.br usuario@exemplo.com\n"
}

echored() {
    echo -ne "\033[41m\033[37m\033[1m  $1  \033[0m\n"
}

echoblue() {
    echo -ne "\033[44m\033[37m\033[1m  $1  \033[0m\n"
}

# ===============================
# Checagens iniciais
# ===============================
if ! [ -n "$BASH_VERSION" ]; then
    echo "Este script deve ser executado com Bash."
    show_usage
    exit 1
fi

# ===============================
# Branch opcional
# ===============================
if [ "$1" = "-b" ]; then
    BRANCH=$2
    shift 2
fi

# ===============================
# Verifica root
# ===============================
if [[ $EUID -ne 0 ]]; then
    echo "O script precisa ser executado como root."
    exit 1
fi

# ===============================
# Parâmetros
# ===============================
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
    show_usage
    exit 1
fi

# ===============================
# Mensagem inicial
# ===============================
echoblue "Iniciando instalação do Projeto Multitenant"
sleep 2

CURFOLDER=${PWD}

# ===============================
# Instala Docker se necessário
# ===============================
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
fi

# ===============================
# Clona ou atualiza repositório
# ===============================
TARGET_DIR="$HOME/Projeto-menu-multitenant-seguro"

rm -rf "$TARGET_DIR"
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git "$TARGET_DIR"
cd "$TARGET_DIR" || exit 1

if ! git diff-index --quiet HEAD --; then
    git stash push &> /dev/null
fi

git fetch --all
if [ -n "${BRANCH}" ]; then
    git checkout ${BRANCH} 2>/dev/null || git checkout -t origin/${BRANCH}
fi
git pull

# ===============================
# Gera segredos dinâmicos
# ===============================
DB_USER="user_$(openssl rand -hex 4)"
DB_PASSWORD="$(openssl rand -hex 16)"
DB_NAME="db_$(openssl rand -hex 4)"
JWT_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(openssl rand -hex 32)"

# ===============================
# Gera .env a partir do .env.example
# ===============================
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

# ===============================
# Substitui SUPER_ADMIN no seed.ts
# ===============================
SEED_FILE="apps/backend/prisma/seed.ts"
if [ -f "$SEED_FILE" ]; then
    sed -i "s/'admin@system.com'/'$EMAIL'/g" "$SEED_FILE"
fi

# ===============================
# Gera nginx.conf
# ===============================
NGINX_FILE="/etc/nginx/sites-available/multitenant.conf"

cat > "$NGINX_FILE" << EOF
upstream frontend_app {
    server 127.0.0.1:5000;
}

upstream backend_api {
    server 127.0.0.1:4000;
}

server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://frontend_app;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api {
        proxy_pass http://backend_api;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    access_log /var/log/nginx/multitenant.access.log;
    error_log  /var/log/nginx/multitenant.error.log;
}
EOF

ln -sf "$NGINX_FILE" /etc/nginx/sites-enabled/multitenant.conf
nginx -t && systemctl reload nginx

# ===============================
# Baixa imagens
# ===============================
docker compose pull

# ===============================
# Executa migrações e seed
# ===============================
docker compose run --rm backend npx prisma migrate deploy
docker compose run --rm backend npx prisma db seed

# ===============================
# Sobe containers
# ===============================
docker compose down
docker compose up -d

if [ $? -ne 0 ]; then
    echored "Falha ao subir containers."
    exit 1
fi

# ===============================
# Exibe credenciais geradas
# ===============================
echoblue "Instalação concluída com sucesso!"
echo ""
echo "Salve estas informações para referência futura:"
echo "-------------------------------------------------"
echo "Dominio: ${DOMAIN}"
echo "Email de admin: ${EMAIL}"
echo ""
echo "DB_USER: $DB_USER"
echo "DB_PASSWORD: $DB_PASSWORD"
echo "DB_NAME: $DB_NAME"
echo "JWT_SECRET: $JWT_SECRET"
echo "ENCRYPTION_KEY: $ENCRYPTION_KEY"
echo "-------------------------------------------------"
echo ""
echo "A aplicação estará disponível em: https://${DOMAIN}"
echo "Login padrão: ${EMAIL} / senha: 123456 (alterável após primeiro acesso)"
