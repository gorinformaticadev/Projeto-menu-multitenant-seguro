#!/bin/bash

# ============================================
# 🔧 Script de Correção - Casting Prisma
# ============================================
# 
# Remove o casting temporário (as any) após regenerar
# o cliente Prisma com as novas tabelas
#
# Uso: ./fix-prisma-casting.sh
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

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ] || [ ! -d "src/update" ]; then
    echo "Execute este script a partir do diretório backend/"
    exit 1
fi

log "=== Iniciando Correção do Casting Prisma ==="

# Arquivos a serem corrigidos
files=(
    "src/update/update.service.ts"
    "src/update/update-cron.service.ts"
)

# Fazer backup dos arquivos
log "Criando backup dos arquivos..."
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$file.backup"
        log "Backup criado: $file.backup"
    fi
done

# Aplicar correções
log "Aplicando correções..."

# UpdateService
if [ -f "src/update/update.service.ts" ]; then
    log "Corrigindo update.service.ts..."
    
    # Substituir casting do updateLog
    sed -i 's/(this\.prisma as any)\.updateLog/this.prisma.updateLog/g' src/update/update.service.ts
    
    # Substituir casting do systemSettings
    sed -i 's/(this\.prisma as any)\.systemSettings/this.prisma.systemSettings/g' src/update/update.service.ts
    
    success "update.service.ts corrigido"
fi

# UpdateCronService
if [ -f "src/update/update-cron.service.ts" ]; then
    log "Corrigindo update-cron.service.ts..."
    
    # Substituir casting do updateLog
    sed -i 's/(this\.prisma as any)\.updateLog/this.prisma.updateLog/g' src/update/update-cron.service.ts
    
    success "update-cron.service.ts corrigido"
fi

# Verificar se as correções foram aplicadas
log "Verificando correções..."

casting_found=false
for file in "${files[@]}"; do
    if [ -f "$file" ] && grep -q "(this\.prisma as any)" "$file"; then
        warning "Ainda há casting em $file"
        casting_found=true
    fi
done

if [ "$casting_found" = false ]; then
    success "Todas as correções aplicadas com sucesso!"
else
    warning "Algumas correções podem não ter sido aplicadas"
fi

# Testar compilação
log "Testando compilação..."
if npm run build > /dev/null 2>&1; then
    success "Compilação bem-sucedida!"
else
    warning "Erro na compilação. Verifique os arquivos manualmente."
    
    # Restaurar backups em caso de erro
    log "Restaurando backups..."
    for file in "${files[@]}"; do
        if [ -f "$file.backup" ]; then
            mv "$file.backup" "$file"
            log "Backup restaurado: $file"
        fi
    done
    exit 1
fi

# Remover backups se tudo deu certo
log "Removendo backups..."
for file in "${files[@]}"; do
    if [ -f "$file.backup" ]; then
        rm "$file.backup"
        log "Backup removido: $file.backup"
    fi
done

success "=== Correção Concluída com Sucesso ==="
log "O sistema de updates agora tem tipagem completa do Prisma!"
log "Reinicie o backend: npm run start:dev"