#!/bin/bash

# ============================================
# 🧹 Script de Limpeza de Backups
# ============================================
# 
# Funcionalidades:
# - Remove backups com mais de 10 dias
# - Preserva sempre os 3 backups mais recentes
# - Registra operações em logs
# - Exibe informações dos backups
#
# Uso:
#   ./cleanup.sh           # Executar limpeza
#   ./cleanup.sh info      # Exibir informações
#   ./cleanup.sh --dry-run # Simular limpeza
#
# ============================================

set -e

# Configurações
BACKUP_DIR="${UPDATE_BACKUP_DIR:-/var/backups/app}"
LOG_DIR="${UPDATE_LOG_DIR:-/var/log/app-updates}"
RETENTION_DAYS=10
MIN_BACKUPS_TO_KEEP=3

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Função de log com timestamp
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_DIR/cleanup.log" 2>/dev/null || true
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_DIR/cleanup.log" 2>/dev/null || true
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1" >> "$LOG_DIR/cleanup.log" 2>/dev/null || true
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_DIR/cleanup.log" 2>/dev/null || true
}

# Converter bytes para formato legível
human_readable_size() {
    local bytes=$1
    local units=("B" "KB" "MB" "GB" "TB")
    local unit=0
    
    while [ $bytes -gt 1024 ] && [ $unit -lt 4 ]; do
        bytes=$((bytes / 1024))
        unit=$((unit + 1))
    done
    
    echo "${bytes}${units[$unit]}"
}

# Exibir informações dos backups
show_backup_info() {
    log "=== Informações dos Backups ==="
    
    if [ ! -d "$BACKUP_DIR" ]; then
        warning "Diretório de backup não existe: $BACKUP_DIR"
        return 1
    fi
    
    local total_backups=0
    local total_size=0
    local oldest_backup=""
    local newest_backup=""
    
    echo
    printf "%-25s %-15s %-20s %s\n" "BACKUP" "TAMANHO" "DATA CRIAÇÃO" "IDADE"
    printf "%-25s %-15s %-20s %s\n" "$(printf '%*s' 25 '' | tr ' ' '-')" "$(printf '%*s' 15 '' | tr ' ' '-')" "$(printf '%*s' 20 '' | tr ' ' '-')" "$(printf '%*s' 10 '' | tr ' ' '-')"
    
    # Listar backups ordenados por data (mais recente primeiro)
    for backup_dir in $(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | sort -r); do
        if [ -d "$backup_dir" ]; then
            local backup_name=$(basename "$backup_dir")
            local backup_size=$(du -sb "$backup_dir" 2>/dev/null | cut -f1 || echo "0")
            local backup_date=$(stat -c %Y "$backup_dir" 2>/dev/null || echo "0")
            local backup_date_formatted=$(date -d "@$backup_date" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown")
            local days_old=$(( ($(date +%s) - backup_date) / 86400 ))
            
            printf "%-25s %-15s %-20s %s dias\n" \
                "$backup_name" \
                "$(human_readable_size $backup_size)" \
                "$backup_date_formatted" \
                "$days_old"
            
            total_backups=$((total_backups + 1))
            total_size=$((total_size + backup_size))
            
            if [ -z "$oldest_backup" ] || [ $backup_date -lt $(stat -c %Y "$oldest_backup" 2>/dev/null || echo "0") ]; then
                oldest_backup="$backup_dir"
            fi
            
            if [ -z "$newest_backup" ] || [ $backup_date -gt $(stat -c %Y "$newest_backup" 2>/dev/null || echo "0") ]; then
                newest_backup="$backup_dir"
            fi
        fi
    done
    
    echo
    log "Total de backups: $total_backups"
    log "Tamanho total: $(human_readable_size $total_size)"
    
    if [ $total_backups -gt 0 ]; then
        log "Backup mais antigo: $(basename "$oldest_backup")"
        log "Backup mais recente: $(basename "$newest_backup")"
    fi
    
    # Verificar espaço em disco
    local disk_usage=$(df -h "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    log "Uso do disco: ${disk_usage}%"
    
    if [ $disk_usage -gt 80 ]; then
        warning "Uso do disco acima de 80%! Considere executar limpeza."
    fi
}

# Executar limpeza de backups
cleanup_backups() {
    local dry_run="$1"
    
    log "=== Iniciando Limpeza de Backups ==="
    log "Diretório: $BACKUP_DIR"
    log "Retenção: $RETENTION_DAYS dias"
    log "Mínimo a manter: $MIN_BACKUPS_TO_KEEP backups"
    
    if [ "$dry_run" = "true" ]; then
        log "MODO SIMULAÇÃO - Nenhum arquivo será removido"
    fi
    
    if [ ! -d "$BACKUP_DIR" ]; then
        warning "Diretório de backup não existe: $BACKUP_DIR"
        return 0
    fi
    
    # Data limite (X dias atrás)
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%s)
    
    # Listar todos os backups ordenados por data (mais recente primeiro)
    local backups=($(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" -printf "%T@ %p\n" | sort -nr | cut -d' ' -f2-))
    local total_backups=${#backups[@]}
    
    log "Encontrados $total_backups backups"
    
    if [ $total_backups -eq 0 ]; then
        log "Nenhum backup encontrado"
        return 0
    fi
    
    local removed_count=0
    local preserved_count=0
    local total_size_removed=0
    
    # Processar cada backup
    for i in "${!backups[@]}"; do
        local backup_dir="${backups[$i]}"
        local backup_name=$(basename "$backup_dir")
        local backup_date=$(stat -c %Y "$backup_dir" 2>/dev/null || echo "0")
        local days_old=$(( ($(date +%s) - backup_date) / 86400 ))
        local backup_size=$(du -sb "$backup_dir" 2>/dev/null | cut -f1 || echo "0")
        
        # Decidir se deve remover
        local should_remove=false
        local reason=""
        
        if [ $i -lt $MIN_BACKUPS_TO_KEEP ]; then
            # Preservar os N backups mais recentes
            reason="Preservado (top $MIN_BACKUPS_TO_KEEP mais recentes)"
        elif [ $backup_date -lt $cutoff_date ]; then
            # Remover se for mais antigo que o limite
            should_remove=true
            reason="Removido (>$RETENTION_DAYS dias)"
        else
            reason="Preservado (<$RETENTION_DAYS dias)"
        fi
        
        if [ "$should_remove" = "true" ]; then
            if [ "$dry_run" = "true" ]; then
                log "SIMULAÇÃO: Removeria $backup_name ($days_old dias, $(human_readable_size $backup_size))"
            else
                log "Removendo $backup_name ($days_old dias, $(human_readable_size $backup_size))"
                if rm -rf "$backup_dir"; then
                    success "Backup removido: $backup_name"
                    removed_count=$((removed_count + 1))
                    total_size_removed=$((total_size_removed + backup_size))
                else
                    error "Falha ao remover backup: $backup_name"
                fi
            fi
        else
            log "Preservando $backup_name ($days_old dias, $(human_readable_size $backup_size)) - $reason"
            preserved_count=$((preserved_count + 1))
        fi
    done
    
    # Resumo da operação
    echo
    if [ "$dry_run" = "true" ]; then
        log "=== Resumo da Simulação ==="
        log "Backups que seriam removidos: $removed_count"
        log "Backups que seriam preservados: $preserved_count"
        log "Espaço que seria liberado: $(human_readable_size $total_size_removed)"
    else
        log "=== Resumo da Limpeza ==="
        success "Backups removidos: $removed_count"
        log "Backups preservados: $preserved_count"
        success "Espaço liberado: $(human_readable_size $total_size_removed)"
    fi
}

# Criar diretório de logs se não existir
create_log_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR" 2>/dev/null || true
    fi
}

# Função principal
main() {
    local action="${1:-cleanup}"
    
    create_log_dir
    
    case "$action" in
        "info")
            show_backup_info
            ;;
        "--dry-run")
            cleanup_backups "true"
            ;;
        "cleanup"|"")
            cleanup_backups "false"
            ;;
        *)
            echo "Uso: $0 [info|cleanup|--dry-run]"
            echo
            echo "Opções:"
            echo "  info      - Exibir informações dos backups"
            echo "  cleanup   - Executar limpeza (padrão)"
            echo "  --dry-run - Simular limpeza sem remover arquivos"
            exit 1
            ;;
    esac
}

# Executar função principal
main "$@"