#!/bin/bash

# Cores para saída
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sem cor

clear
echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}      INSTALADOR AUTOMATIZADO - MULTITENANT         ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Perguntar o domínio
echo -e "\n${YELLOW}1. Configuração de Domínio${NC}"
echo -e "Exemplo: meusistema.com"
read -p "Digite o domínio que será utilizado: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Erro: O domínio não pode ser vazio.${NC}"
    exit 1
fi

# Definir URLs baseadas no domínio
FRONTEND_URL="https://$DOMAIN"
BACKEND_URL="https://api.$DOMAIN"

# 2. Gerar credenciais automáticas
echo -e "\n${YELLOW}2. Gerando credenciais seguras...${NC}"

generate_password() {
    openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20
}

generate_secret() {
    openssl rand -hex 32
}

DB_USER="user_$(generate_password | head -c 8)"
DB_PASSWORD=$(generate_password)
DB_NAME="db_multitenant"
JWT_SECRET=$(generate_secret)
ENCRYPTION_KEY=$(generate_secret)

# 3. Criar arquivo .env
echo -e "${YELLOW}3. Criando arquivo .env...${NC}"

cat <<EOF > .env
# Configurações de Domínio
DOMAIN=$DOMAIN
FRONTEND_URL=$FRONTEND_URL
BACKEND_URL=$BACKEND_URL
NEXT_PUBLIC_API_URL=$BACKEND_URL

# Banco de Dados
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# Segredos
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Ambiente
NODE_ENV=production
PORT=4000
EOF

echo -e "${GREEN}Arquivo .env criado com sucesso!${NC}"

# 4. Iniciar Docker
echo -e "\n${YELLOW}4. Iniciando containers Docker...${NC}"
echo -e "${BLUE}Isso pode levar alguns minutos na primeira execução...${NC}"

# Verificar se docker-compose ou docker compose está disponível
if command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
else
    DOCKER_CMD="docker compose"
fi

$DOCKER_CMD up -d --build

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}====================================================${NC}"
    echo -e "${GREEN}      INSTALAÇÃO CONCLUÍDA COM SUCESSO!             ${NC}"
    echo -e "${GREEN}====================================================${NC}"
    
    echo -e "\n${BLUE}Acesse seu sistema em:${NC}"
    echo -e "Frontend: ${YELLOW}$FRONTEND_URL${NC} (Porta: 5000)"
    echo -e "Backend:  ${YELLOW}$BACKEND_URL${NC} (Porta: 4000)"
    
    echo -e "\n${RED}!!! GUARDE ESTAS CREDENCIAIS EM LOCAL SEGURO !!!${NC}"
    echo -e "${BLUE}----------------------------------------------------${NC}"
    echo -e "Usuário DB:     ${YELLOW}$DB_USER${NC}"
    echo -e "Senha DB:       ${YELLOW}$DB_PASSWORD${NC}"
    echo -e "Nome DB:        ${YELLOW}$DB_NAME${NC}"
    echo -e "JWT Secret:     ${YELLOW}$JWT_SECRET${NC}"
    echo -e "Encryption Key: ${YELLOW}$ENCRYPTION_KEY${NC}"
    echo -e "${BLUE}----------------------------------------------------${NC}"
    
    echo -e "\n${YELLOW}Nota:${NC} Certifique-se de configurar seu Proxy Reverso (Nginx/Traefik)"
    echo -e "para apontar o domínio para as portas 5000 e 4000."
    echo -e "Os logs podem ser vistos com: ${BLUE}$DOCKER_CMD logs -f${NC}"
else
    echo -e "\n${RED}Erro ao iniciar os containers. Verifique os logs do Docker.${NC}"
    exit 1
fi
