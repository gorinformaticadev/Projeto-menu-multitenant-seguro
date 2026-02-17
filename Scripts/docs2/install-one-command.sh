#!/bin/bash

# Script de instalação one-command para Sistema Multitenant Seguro
# Uso: curl -sSL https://get.seudominio.com.br | sudo bash -s app.example.com

# Função para mostrar a mensagem de uso
show_usage() {
    echo -e "Uso: \n\n      curl -sSL https://get.seudominio.com.br | sudo bash -s <dominio>\n\n"
    echo -e "Exemplo: \n\n      curl -sSL https://get.seudominio.com.br | sudo bash -s sistema.exemplo.com.br\n\n"
}

# Função para mensagem em vermelho
echored() {
   echo -ne "  \033[41m\033[37m\033[1m"
   echo -n "  $1"
   echo -e "  \033[0m"
}

# Função para mensagem em azul
echoblue() {
   echo -ne "  \033[44m\033[37m\033[1m"
   echo -n "  $1"
   echo -e "  \033[0m"
}

# Função para mensagem em verde
echogreen() {
   echo -ne "  \033[42m\033[37m\033[1m"
   echo -n "  $1"
   echo -e "  \033[0m"
}

# Verifica se está rodando usando o bash
if ! [ -n "$BASH_VERSION" ]; then
   echo "Este script deve ser executado utilizando o bash"
   show_usage
   exit 1
fi

# Verifica se está rodando como root
if [[ $EUID -ne 0 ]]; then
   echo "Este script deve ser executado como root" 
   exit 1
fi

# Verifica se os parâmetros estão corretos
if [ -z "$1" ]; then
    show_usage
    exit 1
fi

# Atribui os valores dos parâmetros a variáveis
dominio="$1"

echo ""
echoblue "                                               "
echoblue "  SISTEMA MULTITENANT SEGURO                   "
echoblue "                                               "
echoblue "  Instalação automatizada via Docker           "
echoblue "                                               "

echo ""
echored "                                               "
echored "  Você está instalando o Sistema Multitenant   "
echored "  Seguro - Código aberto e gratuito            "
echored "                                               "
echored "  Este sistema permite gerenciamento de        "
echored "  múltiplos tenants com segurança              "
echored "                                               "
echored "  Aperte CTRL-C para cancelar                  "
echored "                                               "
echored "  A instalação irá prosseguir em 15 segundos   "
echored "                                               "
echo ""

sleep 15
echo "Prosseguindo com a instalação..."

# salva pasta atual
CURFOLDER=${PWD}

# Passo 1: Instala o docker / apenas se já não tiver instalado
echo "Verificando e instalando Docker..."
which docker > /dev/null || curl -sSL https://get.docker.com | sh

# Passo 2: Baixa o projeto e entra na pasta
echo "Baixando o código fonte..."
[ -d projeto-multitenant ] || git clone https://github.com/seu-usuario/Projeto-menu-multitenant-seguro.git projeto-multitenant
cd projeto-multitenant

# Salva alterações locais se existirem
if ! git diff-index --quiet HEAD -- ; then
  echo "Salvando alterações locais..."
  git stash push &> /dev/null
fi

echo "Atualizando repositório..."
git fetch

echo "Atualizando área de trabalho..."
if ! git pull &> pull.log; then
  echo "Falha ao atualizar repositório, verifique arquivo pull.log"
  exit 1
fi

# Passo 3: Gerar senhas seguras
echo "Gerando configurações e senhas seguras..."

# Gerar senhas aleatórias
DB_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
ADMIN_PASSWORD=$(openssl rand -base64 24 | tr '+/' '_-')

# Criar arquivo .env
cat > .env << EOF
# Configurações do Banco de Dados
DB_USER=multitenant_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=multitenant_db
DB_HOST=db
DB_PORT=5432

# Configurações de Segurança
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
NODE_ENV=production

# URLs do Sistema
FRONTEND_URL=https://$dominio
API_URL=https://$dominio/api

# Portas dos Serviços
BACKEND_PORT=4000
FRONTEND_PORT=5000
EOF

echo "Configurações geradas com sucesso!"

# Passo 4: Criar Docker Compose de produção
echo "Criando Docker Compose para produção..."

cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: multitenant-db-prod
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
    restart: unless-stopped

  backend:
    build: ./apps/backend
    container_name: multitenant-backend-prod
    ports:
      - "${BACKEND_PORT}:4000"
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
      NODE_ENV: ${NODE_ENV}
      PORT: 4000
    volumes:
      - ./apps/backend/uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  frontend:
    build: ./apps/frontend
    container_name: multitenant-frontend-prod
    ports:
      - "${FRONTEND_PORT}:5000"
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
      NODE_ENV: ${NODE_ENV}
    depends_on:
      - backend
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
EOF

echo "Docker Compose criado com sucesso!"

# Passo 5: Baixar todas as imagens
echo "Baixando componentes Docker..."
docker compose -f docker-compose.prod.yml pull

# Passo 6: Iniciar containers
echo "Iniciando containers..."
if ! ( docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up --build -d ); then
    echo "Falha ao iniciar containers"
    exit 1
fi

# Aguardar containers ficarem prontos
echo "Aguardando sistema inicializar (60 segundos)..."
sleep 60

# Passo 7: Popular banco de dados
echo "Inicializando banco de dados..."
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec -T backend npx ts-node prisma/seed.ts

# Passo 8: Mostrar informações finais
echo ""
echogreen "                                               "
echogreen "  INSTALAÇÃO CONCLUÍDA COM SUCESSO!           "
echogreen "                                               "

cat << EOF

🎉 SISTEMA MULTITENANT SEGURO INSTALADO!

📌 ACESSO AO SISTEMA:
--------------------------------------------------
Frontend: https://$dominio
Backend API: https://$dominio/api
Banco de Dados: localhost:5432

🔑 CREDENCIAIS GERADAS:
--------------------------------------------------
📧 Usuários do Sistema:

SUPER_ADMIN:
  Email: admin@system.com
  Senha: $ADMIN_PASSWORD

ADMIN (Tenant):
  Email: admin@empresa1.com  
  Senha: $ADMIN_PASSWORD

USER (Comum):
  Email: user@empresa1.com
  Senha: $ADMIN_PASSWORD

🔒 Configurações de Segurança:
--------------------------------------------------
Database User: multitenant_user
Database Password: $DB_PASSWORD
Database Name: multitenant_db

JWT Secret: $JWT_SECRET

📁 Diretórios Importantes:
--------------------------------------------------
Código Fonte: $(pwd)
Dados do Banco: ./postgres_data
Uploads: ./apps/backend/uploads

💡 PRÓXIMOS PASSOS:
--------------------------------------------------
1. Acesse https://$dominio
2. Faça login com qualquer conta acima
3. Configure seu domínio e SSL
4. Personalize conforme sua necessidade

⚠️ RECOMENDAÇÕES DE SEGURANÇA:
--------------------------------------------------
- Configure HTTPS com Let's Encrypt
- Altere as senhas padrão em produção
- Configure firewall e segurança de rede
- Faça backup regular do banco de dados

Data da instalação: $(date +"%d/%m/%Y %H:%M:%S")

EOF

echo "Removendo imagens antigas..."
docker system prune -af &> /dev/null

echo ""
echoblue "                                               "
echoblue "  INSTALAÇÃO FINALIZADA!                       "
echoblue "                                               "
echoblue "  Acesse: https://$dominio                     "
echoblue "                                               "#!/bin/bash

# Script de instalação one-command para Sistema Multitenant Seguro
# Uso: curl -sSL https://get.seudominio.com.br | sudo bash -s app.example.com

# Função para mostrar a mensagem de uso
show_usage() {
    echo -e "Uso: \n\n      curl -sSL https://get.seudominio.com.br | sudo bash -s <dominio>\n\n"
    echo -e "Exemplo: \n\n      curl -sSL https://get.seudominio.com.br | sudo bash -s sistema.exemplo.com.br\n\n"
}

# Função para mensagem em vermelho
echored() {
   echo -ne "  \033[41m\033[37m\033[1m"
   echo -n "  $1"
   echo -e "  \033[0m"
}

# Função para mensagem em azul
echoblue() {
   echo -ne "  \033[44m\033[37m\033[1m"
   echo -n "  $1"
   echo -e "  \033[0m"
}

# Função para mensagem em verde
echogreen() {
   echo -ne "  \033[42m\033[37m\033[1m"
   echo -n "  $1"
   echo -e "  \033[0m"
}

# Verifica se está rodando usando o bash
if ! [ -n "$BASH_VERSION" ]; then
   echo "Este script deve ser executado utilizando o bash"
   show_usage
   exit 1
fi

# Verifica se está rodando como root
if [[ $EUID -ne 0 ]]; then
   echo "Este script deve ser executado como root" 
   exit 1
fi

# Verifica se os parâmetros estão corretos
if [ -z "$1" ]; then
    show_usage
    exit 1
fi

# Atribui os valores dos parâmetros a variáveis
dominio="$1"

echo ""
echoblue "                                               "
echoblue "  SISTEMA MULTITENANT SEGURO                   "
echoblue "                                               "
echoblue "  Instalação automatizada via Docker           "
echoblue "                                               "

echo ""
echored "                                               "
echored "  Você está instalando o Sistema Multitenant   "
echored "  Seguro - Código aberto e gratuito            "
echored "                                               "
echored "  Este sistema permite gerenciamento de        "
echored "  múltiplos tenants com segurança              "
echored "                                               "
echored "  Aperte CTRL-C para cancelar                  "
echored "                                               "
echored "  A instalação irá prosseguir em 15 segundos   "
echored "                                               "
echo ""

sleep 15
echo "Prosseguindo com a instalação..."

# salva pasta atual
CURFOLDER=${PWD}

# Passo 1: Instala o docker / apenas se já não tiver instalado
echo "Verificando e instalando Docker..."
which docker > /dev/null || curl -sSL https://get.docker.com | sh

# Passo 2: Baixa o projeto e entra na pasta
echo "Baixando o código fonte..."
[ -d projeto-multitenant ] || git clone https://github.com/seu-usuario/Projeto-menu-multitenant-seguro.git projeto-multitenant
cd projeto-multitenant

# Salva alterações locais se existirem
if ! git diff-index --quiet HEAD -- ; then
  echo "Salvando alterações locais..."
  git stash push &> /dev/null
fi

echo "Atualizando repositório..."
git fetch

echo "Atualizando área de trabalho..."
if ! git pull &> pull.log; then
  echo "Falha ao atualizar repositório, verifique arquivo pull.log"
  exit 1
fi

# Passo 3: Gerar senhas seguras
echo "Gerando configurações e senhas seguras..."

# Gerar senhas aleatórias
DB_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
ADMIN_PASSWORD=$(openssl rand -base64 24 | tr '+/' '_-')

# Criar arquivo .env
cat > .env << EOF
# Configurações do Banco de Dados
DB_USER=multitenant_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=multitenant_db
DB_HOST=db
DB_PORT=5432

# Configurações de Segurança
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
NODE_ENV=production

# URLs do Sistema
FRONTEND_URL=https://$dominio
API_URL=https://$dominio/api

# Portas dos Serviços
BACKEND_PORT=4000
FRONTEND_PORT=5000
EOF

echo "Configurações geradas com sucesso!"

# Passo 4: Criar Docker Compose de produção
echo "Criando Docker Compose para produção..."

cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: multitenant-db-prod
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
    restart: unless-stopped

  backend:
    build: ./apps/backend
    container_name: multitenant-backend-prod
    ports:
      - "${BACKEND_PORT}:4000"
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
      NODE_ENV: ${NODE_ENV}
      PORT: 4000
    volumes:
      - ./apps/backend/uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  frontend:
    build: ./apps/frontend
    container_name: multitenant-frontend-prod
    ports:
      - "${FRONTEND_PORT}:5000"
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
      NODE_ENV: ${NODE_ENV}
    depends_on:
      - backend
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
EOF

echo "Docker Compose criado com sucesso!"

# Passo 5: Baixar todas as imagens
echo "Baixando componentes Docker..."
docker compose -f docker-compose.prod.yml pull

# Passo 6: Iniciar containers
echo "Iniciando containers..."
if ! ( docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up --build -d ); then
    echo "Falha ao iniciar containers"
    exit 1
fi

# Aguardar containers ficarem prontos
echo "Aguardando sistema inicializar (60 segundos)..."
sleep 60

# Passo 7: Popular banco de dados
echo "Inicializando banco de dados..."
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec -T backend npx ts-node prisma/seed.ts

# Passo 8: Mostrar informações finais
echo ""
echogreen "                                               "
echogreen "  INSTALAÇÃO CONCLUÍDA COM SUCESSO!           "
echogreen "                                               "

cat << EOF

🎉 SISTEMA MULTITENANT SEGURO INSTALADO!

📌 ACESSO AO SISTEMA:
--------------------------------------------------
Frontend: https://$dominio
Backend API: https://$dominio/api
Banco de Dados: localhost:5432

🔑 CREDENCIAIS GERADAS:
--------------------------------------------------
📧 Usuários do Sistema:

SUPER_ADMIN:
  Email: admin@system.com
  Senha: $ADMIN_PASSWORD

ADMIN (Tenant):
  Email: admin@empresa1.com  
  Senha: $ADMIN_PASSWORD

USER (Comum):
  Email: user@empresa1.com
  Senha: $ADMIN_PASSWORD

🔒 Configurações de Segurança:
--------------------------------------------------
Database User: multitenant_user
Database Password: $DB_PASSWORD
Database Name: multitenant_db

JWT Secret: $JWT_SECRET

📁 Diretórios Importantes:
--------------------------------------------------
Código Fonte: $(pwd)
Dados do Banco: ./postgres_data
Uploads: ./apps/backend/uploads

💡 PRÓXIMOS PASSOS:
--------------------------------------------------
1. Acesse https://$dominio
2. Faça login com qualquer conta acima
3. Configure seu domínio e SSL
4. Personalize conforme sua necessidade

⚠️ RECOMENDAÇÕES DE SEGURANÇA:
--------------------------------------------------
- Configure HTTPS com Let's Encrypt
- Altere as senhas padrão em produção
- Configure firewall e segurança de rede
- Faça backup regular do banco de dados

Data da instalação: $(date +"%d/%m/%Y %H:%M:%S")

EOF

echo "Removendo imagens antigas..."
docker system prune -af &> /dev/null

echo ""
echoblue "                                               "
echoblue "  INSTALAÇÃO FINALIZADA!                       "
echoblue "                                               "
echoblue "  Acesse: https://$dominio                     "
echoblue "                                               "