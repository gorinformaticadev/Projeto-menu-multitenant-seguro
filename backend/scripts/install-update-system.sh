#!/bin/bash

# ============================================
# 🚀 Script de Instalação do Sistema de Updates
# ============================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Verificar se estamos no diretório correto
check_directory() {
    if [ ! -f "package.json" ] || [ ! -d "src" ]; then
        error "Execute este script a partir do diretório backend/"
        exit 1
    fi
}

# Instalar dependências
install_dependencies() {
    log "Instalando dependências do sistema de updates..."
    
    if command -v pnpm &> /dev/null; then
        pnpm add semver
        pnpm add -D @types/semver
    elif command -v yarn &> /dev/null; then
        yarn add semver
        yarn add -D @types/semver
    else
        npm install semver
        npm install -D @types/semver
    fi
    
    success "Dependências instaladas"
}

# Gerar cliente Prisma
generate_prisma() {
    log "Gerando cliente Prisma..."
    
    if command -v pnpm &> /dev/null; then
        pnpm prisma generate
    elif command -v yarn &> /dev/null; then
        yarn prisma generate
    else
        npm run prisma:generate
    fi
    
    success "Cliente Prisma gerado"
}

# Executar migração
run_migration() {
    log "Executando migração do banco de dados..."
    
    if command -v pnpm &> /dev/null; then
        pnpm prisma migrate deploy
    elif command -v yarn &> /dev/null; then
        yarn prisma migrate deploy
    else
        npx prisma migrate deploy
    fi
    
    success "Migração executada"
}

# Criar diretórios necessários
create_directories() {
    log "Criando diretórios necessários..."
    
    local backup_dir="${UPDATE_BACKUP_DIR:-/var/backups/app}"
    local log_dir="${UPDATE_LOG_DIR:-/var/log/app-updates}"
    
    # Tentar criar com sudo se necessário
    if [ ! -d "$backup_dir" ]; then
        if mkdir -p "$backup_dir" 2>/dev/null; then
            success "Diretório de backup criado: $backup_dir"
        elif sudo mkdir -p "$backup_dir" 2>/dev/null; then
            sudo chown -R $USER:$USER "$backup_dir"
            success "Diretório de backup criado com sudo: $backup_dir"
        else
            warning "Não foi possível criar $backup_dir. Crie manualmente."
        fi
    fi
    
    if [ ! -d "$log_dir" ]; then
        if mkdir -p "$log_dir" 2>/dev/null; then
            success "Diretório de logs criado: $log_dir"
        elif sudo mkdir -p "$log_dir" 2>/dev/null; then
            sudo chown -R $USER:$USER "$log_dir"
            success "Diretório de logs criado com sudo: $log_dir"
        else
            warning "Não foi possível criar $log_dir. Crie manualmente."
        fi
    fi
}

# Configurar permissões dos scripts
setup_permissions() {
    log "Configurando permissões dos scripts..."
    
    if [ -f "scripts/update.sh" ]; then
        chmod +x scripts/update.sh
        success "Permissões configuradas para update.sh"
    fi
    
    if [ -f "scripts/cleanup.sh" ]; then
        chmod +x scripts/cleanup.sh
        success "Permissões configuradas para cleanup.sh"
    fi
}

# Verificar variáveis de ambiente
check_env_vars() {
    log "Verificando variáveis de ambiente..."
    
    local env_file=".env"
    local missing_vars=()
    
    if [ ! -f "$env_file" ]; then
        warning "Arquivo .env não encontrado"
        return 1
    fi
    
    # Verificar variáveis essenciais
    if ! grep -q "DATABASE_URL" "$env_file"; then
        missing_vars+=("DATABASE_URL")
    fi
    
    if ! grep -q "ENCRYPTION_KEY" "$env_file"; then
        missing_vars+=("ENCRYPTION_KEY")
    fi
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        warning "Variáveis de ambiente faltando: ${missing_vars[*]}"
        log "Adicione as seguintes variáveis ao arquivo .env:"
        for var in "${missing_vars[@]}"; do
            case $var in
                "ENCRYPTION_KEY")
                    echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
                    ;;
                "DATABASE_URL")
                    echo "DATABASE_URL=postgresql://user:password@localhost:5432/database"
                    ;;
            esac
        done
        return 1
    fi
    
    success "Variáveis de ambiente verificadas"
}

# Testar instalação
test_installation() {
    log "Testando instalação..."
    
    # Testar script de backup
    if [ -f "scripts/update.sh" ]; then
        log "Testando script de backup..."
        if ./scripts/update.sh > /dev/null 2>&1; then
            success "Script de backup funcionando"
        else
            warning "Erro no teste do script de backup"
        fi
    fi
    
    # Testar script de limpeza
    if [ -f "scripts/cleanup.sh" ]; then
        log "Testando script de limpeza..."
        if ./scripts/cleanup.sh --dry-run > /dev/null 2>&1; then
            success "Script de limpeza funcionando"
        else
            warning "Erro no teste do script de limpeza"
        fi
    fi
}

# Exibir resumo
show_summary() {
    echo
    success "=== Instalação do Sistema de Updates Concluída ==="
    echo
    log "Próximos passos:"
    echo "1. Reinicie o backend: npm run start:dev"
    echo "2. Acesse: http://localhost:3000/configuracoes/sistema/updates"
    echo "3. Configure o repositório Git"
    echo "4. Teste a conectividade"
    echo "5. Execute a primeira verificação"
    echo
    log "Documentação:"
    echo "- DOCS/SISTEMA_UPDATES_IMPLEMENTADO.md"
    echo "- DOCS/GUIA_INSTALACAO_SISTEMA_UPDATES.md"
    echo
}

# Função principal
main() {
    log "=== Iniciando Instalação do Sistema de Updates ==="
    
    check_directory
    install_dependencies
    generate_prisma
    run_migration
    create_directories
    setup_permissions
    
    if check_env_vars; then
        test_installation
    else
        warning "Configure as variáveis de ambiente antes de continuar"
    fi
    
    show_summary
}

# Executar instalação
main "$@"