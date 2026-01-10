#!/bin/bash

# Script de instalação one-command - CORRIGIDO PARA ARQUIVOS NÃO RASTREADOS
# Uso: curl -sSL https://raw.githubusercontent.com/gorinformaticadev/Projeto-menu-multitenant-seguro/main/install.sh | sudo bash -s app.exemplo.com.br

show_usage() {
    echo -e "Uso: \n\n      curl -sSL https://raw.githubusercontent.com/gorinformaticadev/Projeto-menu-multitenant-seguro/main/install.sh | sudo bash -s <dominio>\n\n"
    echo -e "Exemplo: \n\n      curl -sSL https://raw.githubusercontent.com/gorinformaticadev/Projeto-menu-multitenant-seguro/main/install.sh | sudo bash -s sistema.exemplo.com.br\n\n"
}

echored() {
   echo -ne "  \033[41m\033[37m\033[1m"
   echo -n "  $1"
   echo -e "  \033[0m"
}

echoblue() {
   echo -ne "  \033[44m\033[37m\033[1m"
   echo -n "  $1"
   echo -e "  \033[0m"
}

echogreen() {
   echo -ne "  \033[42m\033[37m\033[1m"
   echo -n "  $1"
   echo -e "  \033[0m"
}

# Verificações
if ! [ -n "$BASH_VERSION" ]; then
   echo "Este script deve ser executado utilizando o bash"
   show_usage
   exit 1
fi

if [[ $EUID -ne 0 ]]; then
   echo "Este script deve ser executado como root" 
   exit 1
fi

if [ -z "$1" ]; then
    show_usage
    exit 1
fi

dominio="$1"

echo ""
echoblue "                                               "
echoblue "  SISTEMA MULTITENANT SEGURO - CORRIGIDO       "
echoblue "                                               "
echoblue "  Tratamento de arquivos não rastreados        "
echoblue "                                               "

echo ""
echored "                                               "
echored "  Instalação otimizada - 2 segundos            "
echored "                                               "
echo ""

sleep 2
echo "Prosseguindo com a instalação..."

CURFOLDER=${PWD}

# Instalar Docker se necessário
echo "Verificando Docker..."
which docker > /dev/null || curl -sSL https://get.docker.com | sh

# Baixar projeto ou atualizar existente
if [ -d "projeto-multitenant" ]; then
    echo "Atualizando projeto existente..."
    cd projeto-multitenant
    
    # Lidar com arquivos não rastreados
    echo "Verificando arquivos locais..."
    if [ -n "$(git status --porcelain)" ]; then
        echo "Encontrados arquivos locais, fazendo backup..."
        git stash push -m "Backup automático antes da atualização" 2>/dev/null || true
    fi
    
    # Tentar pull, se falhar faz clone limpo
    if ! git pull; then
        echo "Pull falhou, fazendo clone limpo..."
        cd ..
        rm -rf projeto-multitenant
        git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git projeto-multitenant
        cd projeto-multitenant
    fi
else
    echo "Baixando código fonte..."
    git clone https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro.git projeto-multitenant
    cd projeto-multitenant
fi

# Garantir que estamos na branch main
git checkout main 2>/dev/null || true

# Gerar configurações - CORRIGIDO
echo "Gerando configurações..."
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 16)

# Validar senhas geradas
if [ ${#DB_PASSWORD} -ne 32 ] || [ ${#JWT_SECRET} -ne 64 ] || [ ${#ADMIN_PASSWORD} -ne 16 ]; then
    echo "Erro ao gerar senhas seguras"
    echo "DB_PASSWORD length: ${#DB_PASSWORD}"
    echo "JWT_SECRET length: ${#JWT_SECRET}"  
    echo "ADMIN_PASSWORD length: ${#ADMIN_PASSWORD}"
    exit 1
fi

# Criar .env com validação
cat > .env << EOF
DB_USER=multitenant_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=multitenant_db
DB_HOST=db
DB_PORT=5432
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
NODE_ENV=production
FRONTEND_URL=https://$dominio
API_URL=https://$dominio/api
BACKEND_PORT=4000
FRONTEND_PORT=5000
EOF

# Validar .env
if ! grep -q "JWT_SECRET=" .env; then
    echo "Erro ao criar arquivo .env"
    cat .env
    exit 1
fi

echo "Configurações geradas com sucesso!"

# Testar Docker Compose
echo "Testando configuração Docker..."
if ! docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    echo "Erro na configuração do Docker Compose"
    echo "Conteúdo do docker-compose.prod.yml:"
    cat docker-compose.prod.yml
    exit 1
fi

# Parar containers antigos se existirem
echo "Parando containers antigos..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Construir e iniciar
echo "Construindo e iniciando containers..."
BUILD_START=$(date +%s)
if ! docker-compose -f docker-compose.prod.yml up --build -d; then
    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))
    echo "Falha ao iniciar containers após ${BUILD_TIME} segundos"
    echo "Verificando logs..."
    docker-compose -f docker-compose.prod.yml logs --tail=20
    exit 1
fi

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
echo "Build concluído em ${BUILD_TIME} segundos"

# Aguardar inicialização
echo "Aguardando sistema iniciar (20 segundos)..."
sleep 20

# Verificar se containers estão rodando
echo "Verificando status dos containers..."
CONTAINER_STATUS=$(docker-compose -f docker-compose.prod.yml ps)
if ! echo "$CONTAINER_STATUS" | grep -q "Up"; then
    echo "Containers não estão rodando corretamente:"
    echo "$CONTAINER_STATUS"
    echo "Logs dos containers:"
    docker-compose -f docker-compose.prod.yml logs --tail=10
    exit 1
fi

# Inicializar banco de dados
echo "Inicializando banco de dados..."
if ! docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy; then
    echo "Erro ao executar migrations"
    docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy --verbose
    exit 1
fi

if ! docker-compose -f docker-compose.prod.yml exec -T backend npx ts-node prisma/seed.ts; then
    echo "Erro ao executar seed"
    docker-compose -f docker-compose.prod.yml exec -T backend npx ts-node prisma/seed.ts --verbose
    exit 1
fi

# Mostrar resultados
echo ""
echogreen "                                               "
echogreen "  INSTALAÇÃO CONCLUÍDA COM SUCESSO!           "
echogreen "                                               "

cat << EOF

🎉 SISTEMA MULTITENANT SEGURO INSTALADO!

📌 ACESSO:
Frontend: https://$dominio
Backend: https://$dominio/api
Banco: localhost:5432

🔑 CREDENCIAIS:
SUPER_ADMIN: admin@system.com / $ADMIN_PASSWORD
ADMIN: admin@empresa1.com / $ADMIN_PASSWORD
USER: user@empresa1.com / $ADMIN_PASSWORD

Database: multitenant_user / $DB_PASSWORD
JWT Secret: $JWT_SECRET

Data: $(date +"%d/%m/%Y %H:%M:%S")
Tempo total: ${BUILD_TIME} segundos
EOF

echo ""
echoblue "                                               "
echoblue "  Acesse: https://$dominio                     "
echoblue "                                               "