#!/bin/bash
# install-system.sh - Instalação completa em um comando para Linux/Mac
# Autor: Sistema Multitenant Seguro
# Descrição: Script de instalação automatizada via Docker

set -e  # Abortar em caso de erro

# Definir cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variáveis globais
DB_PASSWORD=""
JWT_SECRET=""
ADMIN_PASSWORD=""
NODE_ENV="development"
FRONTEND_PORT=5000
BACKEND_PORT=4000

print_header() {
    echo -e "${MAGENTA}========================================${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            NODE_ENV="development"
            shift
            ;;
        --prod)
            NODE_ENV="production"
            shift
            ;;
        --staging)
            NODE_ENV="staging"
            shift
            ;;
        --db-password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        --jwt-secret)
            JWT_SECRET="$2"
            shift 2
            ;;
        --admin-password)
            ADMIN_PASSWORD="$2"
            shift 2
            ;;
        --frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --report-stats)
            REPORT_STATS=true
            shift
            ;;
        *)
            echo "Opção desconhecida: $1"
            exit 1
            ;;
    esac
done

# 1. Verificar pré-requisitos
check_prerequisites() {
    print_header "🔍 VERIFICANDO PRÉ-REQUISITOS"
    
    local errors=()
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        errors+=("Docker não encontrado. Instale o Docker primeiro.")
    else
        local docker_version=$(docker --version)
        print_success "Docker encontrado: $docker_version"
    fi
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        errors+=("Docker Compose não encontrado.")
    else
        local compose_version=$(docker-compose --version)
        print_success "Docker Compose encontrado: $compose_version"
    fi
    
    # Verificar Git
    if ! command -v git &> /dev/null; then
        errors+=("Git não encontrado. Instale o Git primeiro.")
    else
        local git_version=$(git --version)
        print_success "Git encontrado: $git_version"
    fi
    
    # Verificar OpenSSL (para geração de senhas)
    if ! command -v openssl &> /dev/null; then
        errors+=("OpenSSL não encontrado. Necessário para geração de senhas seguras.")
    fi
    
    if [ ${#errors[@]} -gt 0 ]; then
        print_error "Erros encontrados:"
        for error in "${errors[@]}"; do
            echo "   - $error"
        done
        exit 1
    fi
    
    print_success "Todos os pré-requisitos atendidos!"
}

# 2. Gerar configurações e senhas
generate_configs() {
    print_header "🔐 GERANDO CONFIGURAÇÕES E SENHAS SEGURAS"
    
    # Gerar senhas aleatórias seguras
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(openssl rand -base64 32)
    fi
    
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 64)
    fi
    
    if [ -z "$ADMIN_PASSWORD" ]; then
        # Gerar senha administrativa segura
        ADMIN_PASSWORD=$(openssl rand -base64 24 | tr '+/' '_-')
    fi
    
    # Criar arquivo .env
    cat > .env << EOF
# ============================================
# CONFIGURAÇÕES DO BANCO DE DADOS
# ============================================
DB_USER=multitenant_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=multitenant_db
DB_HOST=db
DB_PORT=5432

# ============================================
# CONFIGURAÇÕES DE SEGURANÇA
# ============================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
NODE_ENV=$NODE_ENV

# ============================================
# URLs DO SISTEMA
# ============================================
FRONTEND_URL=http://localhost:$FRONTEND_PORT
API_URL=http://localhost:$BACKEND_PORT

# ============================================
# PORTAS DOS SERVIÇOS
# ============================================
BACKEND_PORT=$BACKEND_PORT
FRONTEND_PORT=$FRONTEND_PORT
EOF

    print_success "Configurações geradas com sucesso!"
    print_info "Ambiente: $NODE_ENV"
    print_info "Database User: multitenant_user"
    print_info "Frontend Port: $FRONTEND_PORT"
    print_info "Backend Port: $BACKEND_PORT"
}

# 3. Criar Docker Compose otimizado
create_docker_compose() {
    print_header "🐳 CRIANDO DOCKER COMPOSE OTIMIZADO"
    
    cat > docker-compose.install.yml << 'EOF'
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: multitenant-db-install
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
    container_name: multitenant-backend-install
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

  frontend:
    build: ./apps/frontend
    container_name: multitenant-frontend-install
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

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
EOF

    print_success "Docker Compose criado com sucesso!"
}

# 4. Iniciar containers
start_containers() {
    print_header "🚀 INICIANDO CONTAINERS DOCKER"
    
    print_info "Construindo e iniciando containers..."
    
    if ! docker-compose -f docker-compose.install.yml up --build -d; then
        print_error "Erro ao iniciar containers"
        exit 1
    fi
    
    print_warning "Aguardando containers ficarem prontos..."
    sleep 45
    
    # Verificar saúde dos containers
    print_info "Status dos containers:"
    docker-compose -f docker-compose.install.yml ps
    
    print_success "Containers iniciados com sucesso!"
}

# 5. Popular banco de dados
seed_database() {
    print_header "🌱 POPULANDO BANCO DE DADOS"
    
    print_info "Executando migrations..."
    if ! docker-compose -f docker-compose.install.yml exec backend npx prisma migrate deploy; then
        print_error "Erro ao executar migrations"
        exit 1
    fi
    
    print_info "Executando seed..."
    if ! docker-compose -f docker-compose.install.yml exec backend npx ts-node prisma/seed.ts; then
        print_error "Erro ao executar seed"
        exit 1
    fi
    
    print_success "Banco de dados populado com sucesso!"
}

# 6. Verificar saúde do sistema
test_system_health() {
    print_header "🔧 VERIFICANDO SAÚDE DO SISTEMA"
    
    # Verificar database
    if docker-compose -f docker-compose.install.yml exec db pg_isready -U multitenant_user &>/dev/null; then
        print_success "Database: OK"
    else
        print_error "Database: Falhou"
    fi
    
    # Verificar backend
    if docker-compose -f docker-compose.install.yml exec backend wget --quiet --tries=1 --spider http://localhost:4000/health &>/dev/null; then
        print_success "Backend Health: OK"
    else
        print_error "Backend Health: Falhou"
    fi
    
    # Verificar frontend
    if docker-compose -f docker-compose.install.yml exec frontend wget --quiet --tries=1 --spider http://localhost:5000/api/health &>/dev/null; then
        print_success "Frontend Health: OK"
    else
        print_error "Frontend Health: Falhou"
    fi
}

# 7. Exibir credenciais finais
show_credentials() {
    print_header "🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
    
    cat << EOF

====================================================================
🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!
====================================================================

📌 ACESSO AO SISTEMA:
--------------------------------------------------
Frontend: http://localhost:$FRONTEND_PORT
Backend API: http://localhost:$BACKEND_PORT
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
1. Acesse http://localhost:$FRONTEND_PORT
2. Faça login com qualquer conta acima
3. Explore as funcionalidades multitenant
4. Personalize conforme sua necessidade

⚠️ RECOMENDAÇÕES DE SEGURANÇA:
--------------------------------------------------
- Altere as senhas padrão em produção
- Configure HTTPS para ambientes de produção
- Revise as permissões de acesso
- Faça backup regular do banco de dados

Ambiente configurado: $NODE_ENV
Data da instalação: $(date +"%d/%m/%Y %H:%M:%S")

====================================================================
EOF
}

# Função principal
main() {
    print_header "🚀 INICIANDO INSTALAÇÃO COMPLETA DO SISTEMA MULTITENANT"
    
    check_prerequisites
    generate_configs
    create_docker_compose
    start_containers
    seed_database
    test_system_health
    show_credentials
    
    print_success "Instalação concluída! O sistema está pronto para uso."
}

# Executar função principal
main "$@"#!/bin/bash
# install-system.sh - Instalação completa em um comando para Linux/Mac
# Autor: Sistema Multitenant Seguro
# Descrição: Script de instalação automatizada via Docker

set -e  # Abortar em caso de erro

# Definir cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variáveis globais
DB_PASSWORD=""
JWT_SECRET=""
ADMIN_PASSWORD=""
NODE_ENV="development"
FRONTEND_PORT=5000
BACKEND_PORT=4000

print_header() {
    echo -e "${MAGENTA}========================================${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            NODE_ENV="development"
            shift
            ;;
        --prod)
            NODE_ENV="production"
            shift
            ;;
        --staging)
            NODE_ENV="staging"
            shift
            ;;
        --db-password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        --jwt-secret)
            JWT_SECRET="$2"
            shift 2
            ;;
        --admin-password)
            ADMIN_PASSWORD="$2"
            shift 2
            ;;
        --frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --report-stats)
            REPORT_STATS=true
            shift
            ;;
        *)
            echo "Opção desconhecida: $1"
            exit 1
            ;;
    esac
done

# 1. Verificar pré-requisitos
check_prerequisites() {
    print_header "🔍 VERIFICANDO PRÉ-REQUISITOS"
    
    local errors=()
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        errors+=("Docker não encontrado. Instale o Docker primeiro.")
    else
        local docker_version=$(docker --version)
        print_success "Docker encontrado: $docker_version"
    fi
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        errors+=("Docker Compose não encontrado.")
    else
        local compose_version=$(docker-compose --version)
        print_success "Docker Compose encontrado: $compose_version"
    fi
    
    # Verificar Git
    if ! command -v git &> /dev/null; then
        errors+=("Git não encontrado. Instale o Git primeiro.")
    else
        local git_version=$(git --version)
        print_success "Git encontrado: $git_version"
    fi
    
    # Verificar OpenSSL (para geração de senhas)
    if ! command -v openssl &> /dev/null; then
        errors+=("OpenSSL não encontrado. Necessário para geração de senhas seguras.")
    fi
    
    if [ ${#errors[@]} -gt 0 ]; then
        print_error "Erros encontrados:"
        for error in "${errors[@]}"; do
            echo "   - $error"
        done
        exit 1
    fi
    
    print_success "Todos os pré-requisitos atendidos!"
}

# 2. Gerar configurações e senhas
generate_configs() {
    print_header "🔐 GERANDO CONFIGURAÇÕES E SENHAS SEGURAS"
    
    # Gerar senhas aleatórias seguras
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(openssl rand -base64 32)
    fi
    
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 64)
    fi
    
    if [ -z "$ADMIN_PASSWORD" ]; then
        # Gerar senha administrativa segura
        ADMIN_PASSWORD=$(openssl rand -base64 24 | tr '+/' '_-')
    fi
    
    # Criar arquivo .env
    cat > .env << EOF
# ============================================
# CONFIGURAÇÕES DO BANCO DE DADOS
# ============================================
DB_USER=multitenant_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=multitenant_db
DB_HOST=db
DB_PORT=5432

# ============================================
# CONFIGURAÇÕES DE SEGURANÇA
# ============================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
NODE_ENV=$NODE_ENV

# ============================================
# URLs DO SISTEMA
# ============================================
FRONTEND_URL=http://localhost:$FRONTEND_PORT
API_URL=http://localhost:$BACKEND_PORT

# ============================================
# PORTAS DOS SERVIÇOS
# ============================================
BACKEND_PORT=$BACKEND_PORT
FRONTEND_PORT=$FRONTEND_PORT
EOF

    print_success "Configurações geradas com sucesso!"
    print_info "Ambiente: $NODE_ENV"
    print_info "Database User: multitenant_user"
    print_info "Frontend Port: $FRONTEND_PORT"
    print_info "Backend Port: $BACKEND_PORT"
}

# 3. Criar Docker Compose otimizado
create_docker_compose() {
    print_header "🐳 CRIANDO DOCKER COMPOSE OTIMIZADO"
    
    cat > docker-compose.install.yml << 'EOF'
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: multitenant-db-install
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
    container_name: multitenant-backend-install
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

  frontend:
    build: ./apps/frontend
    container_name: multitenant-frontend-install
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

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
EOF

    print_success "Docker Compose criado com sucesso!"
}

# 4. Iniciar containers
start_containers() {
    print_header "🚀 INICIANDO CONTAINERS DOCKER"
    
    print_info "Construindo e iniciando containers..."
    
    if ! docker-compose -f docker-compose.install.yml up --build -d; then
        print_error "Erro ao iniciar containers"
        exit 1
    fi
    
    print_warning "Aguardando containers ficarem prontos..."
    sleep 45
    
    # Verificar saúde dos containers
    print_info "Status dos containers:"
    docker-compose -f docker-compose.install.yml ps
    
    print_success "Containers iniciados com sucesso!"
}

# 5. Popular banco de dados
seed_database() {
    print_header "🌱 POPULANDO BANCO DE DADOS"
    
    print_info "Executando migrations..."
    if ! docker-compose -f docker-compose.install.yml exec backend npx prisma migrate deploy; then
        print_error "Erro ao executar migrations"
        exit 1
    fi
    
    print_info "Executando seed..."
    if ! docker-compose -f docker-compose.install.yml exec backend npx ts-node prisma/seed.ts; then
        print_error "Erro ao executar seed"
        exit 1
    fi
    
    print_success "Banco de dados populado com sucesso!"
}

# 6. Verificar saúde do sistema
test_system_health() {
    print_header "🔧 VERIFICANDO SAÚDE DO SISTEMA"
    
    # Verificar database
    if docker-compose -f docker-compose.install.yml exec db pg_isready -U multitenant_user &>/dev/null; then
        print_success "Database: OK"
    else
        print_error "Database: Falhou"
    fi
    
    # Verificar backend
    if docker-compose -f docker-compose.install.yml exec backend wget --quiet --tries=1 --spider http://localhost:4000/health &>/dev/null; then
        print_success "Backend Health: OK"
    else
        print_error "Backend Health: Falhou"
    fi
    
    # Verificar frontend
    if docker-compose -f docker-compose.install.yml exec frontend wget --quiet --tries=1 --spider http://localhost:5000/api/health &>/dev/null; then
        print_success "Frontend Health: OK"
    else
        print_error "Frontend Health: Falhou"
    fi
}

# 7. Exibir credenciais finais
show_credentials() {
    print_header "🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
    
    cat << EOF

====================================================================
🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!
====================================================================

📌 ACESSO AO SISTEMA:
--------------------------------------------------
Frontend: http://localhost:$FRONTEND_PORT
Backend API: http://localhost:$BACKEND_PORT
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
1. Acesse http://localhost:$FRONTEND_PORT
2. Faça login com qualquer conta acima
3. Explore as funcionalidades multitenant
4. Personalize conforme sua necessidade

⚠️ RECOMENDAÇÕES DE SEGURANÇA:
--------------------------------------------------
- Altere as senhas padrão em produção
- Configure HTTPS para ambientes de produção
- Revise as permissões de acesso
- Faça backup regular do banco de dados

Ambiente configurado: $NODE_ENV
Data da instalação: $(date +"%d/%m/%Y %H:%M:%S")

====================================================================
EOF
}

# Função principal
main() {
    print_header "🚀 INICIANDO INSTALAÇÃO COMPLETA DO SISTEMA MULTITENANT"
    
    check_prerequisites
    generate_configs
    create_docker_compose
    start_containers
    seed_database
    test_system_health
    show_credentials
    
    print_success "Instalação concluída! O sistema está pronto para uso."
}

# Executar função principal
main "$@"