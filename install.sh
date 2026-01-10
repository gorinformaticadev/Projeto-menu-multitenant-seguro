#!/bin/bash

# SCRIPT DE INSTALAÇÃO - FORÇA TOTAL
# Ignora completamente arquivos locais e faz instalação limpa

set -e  # Para em qualquer erro

DOMINIO="$1"

# Verificações básicas
if [ "$EUID" -ne 0 ]; then 
    echo "ERRO: Execute como root"
    exit 1
fi

if [ -z "$DOMINIO" ]; then
    echo "USO: curl -sSL URL | sudo bash -s dominio.com.br"
    exit 1
fi

echo "🚀 INSTALAÇÃO FORÇADA - 1 SEGUNDO"

sleep 1

# Diretório de trabalho
DIR="/root/sistema-multitenant"

# REMOVER TUDO e recomeçar do zero
echo "💥 Limpando instalação anterior..."
rm -rf "$DIR"
mkdir -p "$DIR"
cd "$DIR"

# Clonar repositório fresco
echo "📥 Baixando código..."
git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git .
git checkout main

# Instalar Docker se necessário
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    curl -sSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi

# Gerar senhas SEM caracteres problemáticos
echo "🔐 Gerando configurações..."
DB_PASS=$(openssl rand -hex 16)  # 32 caracteres hexa
JWT_SEC=$(openssl rand -hex 32)  # 64 caracteres hexa  
ADMIN_PASS=$(openssl rand -hex 8)   # 16 caracteres hexa

# Criar .env simples e seguro
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

# Verificar .env
if [ ! -f ".env" ]; then
    echo "ERRO: .env não criado"
    exit 1
fi

# Parar containers antigos
echo "⏹ Parando containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Construir sistema
echo "🏗 Construindo containers..."
docker-compose -f docker-compose.prod.yml up --build -d

# Aguardar
echo "⏱ Aguardando 10 segundos..."
sleep 10

# Verificar containers
echo "🔍 Verificando containers..."
if ! docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "ERRO: Containers não estão rodando"
    docker-compose -f docker-compose.prod.yml ps
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# Inicializar banco
echo "🗄 Inicializando banco..."
docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
docker-compose -f docker-compose.prod.yml exec -T backend npx ts-node prisma/seed.ts

# Sucesso!
echo "✅ INSTALAÇÃO CONCLUÍDA!"

cat << EOF

🎉 SISTEMA PRONTO!

Acesso: https://$DOMINIO
API: https://$DOMINIO/api

Credenciais:
admin@system.com / $ADMIN_PASS
admin@empresa1.com / $ADMIN_PASS  
user@empresa1.com / $ADMIN_PASS

Banco: multitenant_user / $DB_PASS
EOF