#!/bin/bash

# ============================================
# 🚀 Script de Atualização Automática
# ============================================
# 
# Funcionalidades:
# - Backup completo antes da atualização
# - Checkout da versão especificada via Git
# - Instalação de dependências
# - Execução de migrações do banco
# - Build do frontend e backend
# - Reinício dos serviços via PM2
# - Rollback automático em caso de falha
#
# Uso:
#   ./update.sh                    # Apenas backup (modo teste)
#   ./update.sh v1.2.3 npm        # Atualização completa
#   ./update.sh v1.2.3 pnpm       # Com pnpm
#
# ============================================

set -e  # Parar em caso de erro

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${UPDATE_BACKUP_DIR:-/var/backups/app}"
LOG_DIR="${UPDATE_LOG_DIR:-/var/log/app-updates}"
LOCK_FILE="/tmp/app-update.lock"
PM2_BACKEND="${PM2_APP_NAME_BACKEND:-backend}"
PM2_FRONTEND="${PM2_APP_NAME_FRONTEND:-frontend}"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função de log com timestamp
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

# Função de cleanup
cleanup() {
    log "Executando limpeza..."
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
        log "Lock file removido"
    fi
}

# Trap para cleanup em caso de erro ou interrupção
trap cleanup EXIT INT TERM

# Verificar se já existe uma atualização em andamento
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
            error "Atualização já em andamento (PID: $lock_pid)"
            exit 1
        else
            warning "Lock file órfão encontrado, removendo..."
            rm -f "$LOCK_FILE"
        fi
    fi
    
    # Criar lock file
    echo $$ > "$LOCK_FILE"
    log "Lock file criado (PID: $$)"
}

# Verificar pré-requisitos
check_prerequisites() {
    log "Verificando pré-requisitos..."
    
    # Verificar se estamos no diretório correto
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        error "package.json não encontrado. Execute o script a partir do diretório do projeto."
        exit 1
    fi
    
    # Verificar ferramentas necessárias
    local tools=("git" "node" "npm")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "Ferramenta necessária não encontrada: $tool"
            exit 1
        fi
    done
    
    # Verificar PM2 se não estivermos em modo teste
    if [ $# -gt 0 ] && ! command -v pm2 &> /dev/null; then
        error "PM2 não encontrado. Instale com: npm install -g pm2"
        exit 1
    fi
    
    # Verificar PostgreSQL
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump não encontrado. Instale o PostgreSQL client."
        exit 1
    fi
    
    success "Pré-requisitos verificados"
}

# Criar diretórios necessários
create_directories() {
    log "Criando diretórios necessários..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    
    success "Diretórios criados"
}

# Criar backup completo
create_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/backup_$timestamp"
    
    log "Criando backup em: $backup_path"
    
    mkdir -p "$backup_path"
    
    # Backup dos arquivos (excluindo node_modules, .git, etc.)
    log "Fazendo backup dos arquivos..."
    rsync -av \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='dist' \
        --exclude='build' \
        --exclude='.next' \
        --exclude='logs' \
        --exclude='*.log' \
        "$PROJECT_ROOT/" "$backup_path/files/"
    
    # Backup do banco de dados
    if [ -n "$DATABASE_URL" ]; then
        log "Fazendo backup do banco de dados..."
        pg_dump "$DATABASE_URL" > "$backup_path/database.sql"
        
        if [ $? -eq 0 ]; then
            success "Backup do banco criado: $backup_path/database.sql"
        else
            error "Falha no backup do banco de dados"
            exit 1
        fi
    else
        warning "DATABASE_URL não definida, pulando backup do banco"
    fi
    
    # Salvar informações do backup
    cat > "$backup_path/backup_info.txt" << EOF
Backup criado em: $(date)
Versão atual: $(git describe --tags --always 2>/dev/null || echo "unknown")
Commit atual: $(git rev-parse HEAD 2>/dev/null || echo "unknown")
Branch atual: $(git branch --show-current 2>/dev/null || echo "unknown")
Diretório do projeto: $PROJECT_ROOT
EOF
    
    # Retornar caminho do backup
    echo "$backup_path"
    success "Backup completo criado: $backup_path"
}

# Executar rollback
rollback() {
    local backup_path="$1"
    local reason="$2"
    
    error "Executando rollback. Motivo: $reason"
    
    if [ ! -d "$backup_path" ]; then
        error "Backup não encontrado: $backup_path"
        return 1
    fi
    
    # Parar serviços
    log "Parando serviços..."
    pm2 stop "$PM2_BACKEND" "$PM2_FRONTEND" 2>/dev/null || true
    
    # Restaurar arquivos
    log "Restaurando arquivos do backup..."
    rsync -av --delete "$backup_path/files/" "$PROJECT_ROOT/"
    
    # Restaurar banco de dados
    if [ -f "$backup_path/database.sql" ] && [ -n "$DATABASE_URL" ]; then
        log "Restaurando banco de dados..."
        psql "$DATABASE_URL" < "$backup_path/database.sql"
    fi
    
    # Reinstalar dependências
    log "Reinstalando dependências..."
    cd "$PROJECT_ROOT"
    npm ci
    
    # Reiniciar serviços
    log "Reiniciando serviços..."
    pm2 restart "$PM2_BACKEND" "$PM2_FRONTEND"
    
    success "Rollback concluído"
}

# Atualizar para versão especificada
update_to_version() {
    local version="$1"
    local package_manager="${2:-npm}"
    local backup_path="$3"
    
    log "Iniciando atualização para versão: $version"
    log "Package manager: $package_manager"
    
    cd "$PROJECT_ROOT"
    
    # Verificar se a versão existe
    if ! git tag -l | grep -q "^${version}$"; then
        error "Versão não encontrada: $version"
        rollback "$backup_path" "Versão não encontrada"
        exit 1
    fi
    
    # Fazer checkout da versão
    log "Fazendo checkout da versão $version..."
    if ! git checkout "$version"; then
        error "Falha no checkout da versão $version"
        rollback "$backup_path" "Falha no checkout"
        exit 1
    fi
    
    # Instalar dependências do backend
    log "Instalando dependências do backend..."
    cd "$PROJECT_ROOT/backend"
    if ! $package_manager install; then
        error "Falha na instalação das dependências do backend"
        rollback "$backup_path" "Falha na instalação de dependências"
        exit 1
    fi
    
    # Executar migrações do banco
    log "Executando migrações do banco..."
    if ! npx prisma migrate deploy; then
        error "Falha nas migrações do banco"
        rollback "$backup_path" "Falha nas migrações"
        exit 1
    fi
    
    # Build do backend
    log "Fazendo build do backend..."
    if ! $package_manager run build; then
        error "Falha no build do backend"
        rollback "$backup_path" "Falha no build do backend"
        exit 1
    fi
    
    # Instalar dependências do frontend
    log "Instalando dependências do frontend..."
    cd "$PROJECT_ROOT/frontend"
    if ! $package_manager install; then
        error "Falha na instalação das dependências do frontend"
        rollback "$backup_path" "Falha na instalação de dependências do frontend"
        exit 1
    fi
    
    # Build do frontend
    log "Fazendo build do frontend..."
    if ! $package_manager run build; then
        error "Falha no build do frontend"
        rollback "$backup_path" "Falha no build do frontend"
        exit 1
    fi
    
    # Reiniciar serviços
    log "Reiniciando serviços..."
    if ! pm2 restart "$PM2_BACKEND" "$PM2_FRONTEND"; then
        error "Falha ao reiniciar serviços"
        rollback "$backup_path" "Falha ao reiniciar serviços"
        exit 1
    fi
    
    # Aguardar serviços ficarem online
    log "Aguardando serviços ficarem online..."
    sleep 10
    
    # Verificar se serviços estão rodando
    if ! pm2 list | grep -q "online.*$PM2_BACKEND"; then
        error "Backend não está online após reinício"
        rollback "$backup_path" "Backend não iniciou"
        exit 1
    fi
    
    if ! pm2 list | grep -q "online.*$PM2_FRONTEND"; then
        error "Frontend não está online após reinício"
        rollback "$backup_path" "Frontend não iniciou"
        exit 1
    fi
    
    success "Atualização para $version concluída com sucesso!"
}

# Função principal
main() {
    local version="$1"
    local package_manager="${2:-npm}"
    
    log "=== Iniciando Script de Atualização ==="
    log "Versão: ${version:-'Apenas backup'}"
    log "Package Manager: $package_manager"
    log "Projeto: $PROJECT_ROOT"
    
    # Verificações iniciais
    check_lock
    check_prerequisites
    create_directories
    
    # Criar backup
    local backup_path=$(create_backup)
    
    # Se não foi especificada versão, apenas fazer backup (modo teste)
    if [ -z "$version" ]; then
        success "Modo teste: Backup criado com sucesso em $backup_path"
        exit 0
    fi
    
    # Executar atualização
    update_to_version "$version" "$package_manager" "$backup_path"
    
    success "=== Atualização Concluída com Sucesso ==="
    log "Backup disponível em: $backup_path"
}

# Executar função principal com todos os argumentos
main "$@"