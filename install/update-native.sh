#!/usr/bin/env bash
# =============================================================================
# Atualizador Native (PM2) - Projeto Multitenant
# =============================================================================
# Este script realiza o ciclo de atualização para instalações bare-metal
# que utilizam PM2 em vez de Docker.
# =============================================================================

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
RELEASE_TAG="${RELEASE_TAG:-latest}"

log() {
  echo "[native-deploy] $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_err() {
  echo "[native-deploy] ERROR: $*" >&2
}

cd "$PROJECT_ROOT"

log "Iniciando atualização NATIVA para a tag: $RELEASE_TAG"

# --- 1. Verificação de Repositório ---
if [ ! -d ".git" ]; then
    log_err "Diretório não é um repositório Git. Abortando update nativo."
    exit 1
fi

# Capturar versão atual para possível rollback manual
PREV_COMMIT=$(git rev-parse HEAD)
log "Commit atual: $PREV_COMMIT"

# --- 2. Atualização de Código ---
log "Buscando tags e fazendo checkout..."
git fetch --tags --all
if ! git checkout "$RELEASE_TAG"; then
    log_err "Falha ao mudar para a versão $RELEASE_TAG"
    exit 1
fi

# --- 3. Instalação de Dependências ---
log "Instalando dependências via pnpm..."
if ! pnpm install --frozen-lockfile; then
    log "Aviso: pnpm install --frozen-lockfile falhou. Tentando install comum..."
    pnpm install
fi

# --- 4. Build dos Apps ---
log "Compilando Backend (NestJS)..."
if ! pnpm --filter backend build; then
    log_err "Falha no build do backend."
    git checkout "$PREV_COMMIT"
    exit 1
fi

log "Compilando Frontend (Next.js)..."
if ! pnpm --filter frontend build; then
    log_err "Falha no build do frontend."
    git checkout "$PREV_COMMIT"
    exit 1
fi

# --- 5. Migrations do Banco ---
log "Executando migrações do banco de dados..."
cd apps/backend
if ! pnpm exec prisma migrate deploy; then
    log_err "Falha ao aplicar migrações do banco."
    # Rollback de código
    cd "$PROJECT_ROOT"
    git checkout "$PREV_COMMIT"
    exit 1
fi
cd "$PROJECT_ROOT"

# --- 6. Reinício dos Processos PM2 ---
log "Localizando processos PM2 do sistema..."
# Tenta localizar processos que contenham 'backend' ou 'frontend' no nome
BACKEND_PROC=$(pm2 jlist | grep -oP '"name":"[^"]*backend[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
FRONTEND_PROC=$(pm2 jlist | grep -oP '"name":"[^"]*frontend[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

if [ -n "$BACKEND_PROC" ]; then
    log "Reiniciando backend: $BACKEND_PROC"
    pm2 restart "$BACKEND_PROC"
else
    log "ERRO: Processo backend no PM2 não encontrado. Tentando iniciar..."
    pm2 start apps/backend/dist/main.js --name "multitenant-backend"
fi

if [ -n "$FRONTEND_PROC" ]; then
    log "Reiniciando frontend: $FRONTEND_PROC"
    pm2 restart "$FRONTEND_PROC"
else
    log "ERRO: Processo frontend no PM2 não encontrado. Tentando iniciar..."
    pm2 start "pnpm start" --name "multitenant-frontend" --cwd "$PROJECT_ROOT/apps/frontend"
fi

pm2 save

log "Atualização NATIVA concluída com sucesso para a versão $RELEASE_TAG."
