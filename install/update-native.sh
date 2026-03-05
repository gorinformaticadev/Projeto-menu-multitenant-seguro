#!/usr/bin/env bash
# =============================================================================
# Atualizador Native (PM2) - Projeto Multitenant
# =============================================================================
# Este script realiza o ciclo de atualizacao para instalacoes bare-metal
# que utilizam PM2 em vez de Docker.
# =============================================================================

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
RELEASE_TAG="${RELEASE_TAG:-latest}"
GIT_REPO_URL="${GIT_REPO_URL:-}"
GIT_AUTH_HEADER="${GIT_AUTH_HEADER:-}"
RESOLVED_APP_VERSION="unknown"
RESOLVED_GIT_SHA="unknown"
RESOLVED_BUILD_TIME="unknown"
RESOLVED_BRANCH=""

log() {
  echo "[native-deploy] $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_err() {
  echo "[native-deploy] ERROR: $*" >&2
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/}"
  echo "$value"
}

resolve_build_metadata() {
  local repo_dir="$1"
  RESOLVED_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  RESOLVED_APP_VERSION="unknown"
  RESOLVED_GIT_SHA="unknown"
  RESOLVED_BRANCH=""

  if [[ ! -d "$repo_dir/.git" ]]; then
    return 0
  fi

  local full_sha=""
  local short_sha=""
  local exact_tag=""
  full_sha="$(git -C "$repo_dir" rev-parse HEAD 2>/dev/null || true)"
  short_sha="$(git -C "$repo_dir" rev-parse --short HEAD 2>/dev/null || true)"
  exact_tag="$(git -C "$repo_dir" describe --tags --exact-match 2>/dev/null || true)"
  RESOLVED_GIT_SHA="${full_sha:-unknown}"
  RESOLVED_BRANCH="$(git -C "$repo_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

  if [[ -n "$exact_tag" ]]; then
    RESOLVED_APP_VERSION="$exact_tag"
  elif [[ -n "$short_sha" ]]; then
    RESOLVED_APP_VERSION="dev+${short_sha}"
  fi
}

write_build_metadata_files() {
  local target_dir="$1"
  local version_json
  local sha_json
  local build_json
  local branch_json
  version_json="$(json_escape "$RESOLVED_APP_VERSION")"
  sha_json="$(json_escape "$RESOLVED_GIT_SHA")"
  build_json="$(json_escape "$RESOLVED_BUILD_TIME")"
  branch_json="$(json_escape "$RESOLVED_BRANCH")"

  printf '%s\n' "${RESOLVED_APP_VERSION:-unknown}" > "$target_dir/VERSION"
  if [[ -n "$RESOLVED_BRANCH" ]]; then
    printf '{\n  "version": "%s",\n  "commitSha": "%s",\n  "buildDate": "%s",\n  "branch": "%s"\n}\n' \
      "$version_json" "$sha_json" "$build_json" "$branch_json" > "$target_dir/BUILD_INFO.json"
  else
    printf '{\n  "version": "%s",\n  "commitSha": "%s",\n  "buildDate": "%s"\n}\n' \
      "$version_json" "$sha_json" "$build_json" > "$target_dir/BUILD_INFO.json"
  fi
}

git_exec() {
  if [ -n "$GIT_AUTH_HEADER" ]; then
    git -c "http.extraHeader=$GIT_AUTH_HEADER" "$@"
  else
    git "$@"
  fi
}

ensure_git_repository() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  if [ -z "$GIT_REPO_URL" ]; then
    log_err "Diretorio sem repositorio Git e GIT_REPO_URL nao informado. Abortando update nativo."
    exit 1
  fi

  log "Diretorio sem Git. Inicializando repositorio local..."
  git init >/dev/null
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$GIT_REPO_URL"
  else
    git remote add origin "$GIT_REPO_URL"
  fi
}

ensure_origin_remote() {
  if git remote get-url origin >/dev/null 2>&1; then
    return 0
  fi

  if [ -z "$GIT_REPO_URL" ]; then
    log_err "Remote origin nao configurado e GIT_REPO_URL nao informado."
    exit 1
  fi

  git remote add origin "$GIT_REPO_URL"
}

rollback_code() {
  if [ -z "${PREV_COMMIT:-}" ]; then
    log_err "Rollback automatico indisponivel: commit anterior nao identificado."
    return
  fi

  log "Rollback para commit anterior: $PREV_COMMIT"
  git checkout "$PREV_COMMIT" >/dev/null 2>&1 || log_err "Falha ao retornar para commit anterior."
}

cd "$PROJECT_ROOT"

log "Iniciando atualizacao NATIVA para a tag: $RELEASE_TAG"

# --- 1. Verificacao de Repositorio ---
ensure_git_repository
ensure_origin_remote

# Capturar versao atual para possivel rollback manual
PREV_COMMIT=""
if PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null); then
  log "Commit atual: $PREV_COMMIT"
else
  log "Sem commit local anterior. Rollback de codigo pode nao estar disponivel nesta execucao."
fi

# --- 2. Atualizacao de Codigo ---
log "Buscando tags e fazendo checkout..."
git_exec fetch --tags --prune origin
if ! git checkout "$RELEASE_TAG"; then
  log_err "Falha ao mudar para a versao $RELEASE_TAG"
  exit 1
fi

resolve_build_metadata "$PROJECT_ROOT"
write_build_metadata_files "$PROJECT_ROOT"
export APP_VERSION="${RESOLVED_APP_VERSION}"
export GIT_SHA="${RESOLVED_GIT_SHA}"
export BUILD_TIME="${RESOLVED_BUILD_TIME}"
log "Metadata de versao: APP_VERSION=$APP_VERSION GIT_SHA=$GIT_SHA BUILD_TIME=$BUILD_TIME"

# --- 3. Instalacao de Dependencias ---
log "Instalando dependencias via pnpm..."
if ! pnpm install --frozen-lockfile; then
  log "Aviso: pnpm install --frozen-lockfile falhou. Tentando install comum..."
  pnpm install
fi

# --- 4. Build dos Apps ---
log "Compilando Backend (NestJS)..."
if ! pnpm --filter backend build; then
  log_err "Falha no build do backend."
  rollback_code
  exit 1
fi

log "Compilando Frontend (Next.js)..."
if ! pnpm --filter frontend build; then
  log_err "Falha no build do frontend."
  rollback_code
  exit 1
fi

# --- 5. Migrations do Banco ---
log "Executando migracoes do banco de dados..."
cd apps/backend
if ! pnpm exec prisma migrate deploy; then
  log_err "Falha ao aplicar migracoes do banco."
  # Rollback de codigo
  cd "$PROJECT_ROOT"
  rollback_code
  exit 1
fi

log "Executando seed versionado (apenas pendentes)..."
if ! node dist/prisma/seed.js deploy; then
  log_err "Falha ao executar seed versionado."
  cd "$PROJECT_ROOT"
  rollback_code
  exit 1
fi
cd "$PROJECT_ROOT"

# --- 6. Reinicio dos Processos PM2 ---
log "Localizando processos PM2 do sistema..."
# Tenta localizar processos que contenham 'backend' ou 'frontend' no nome
BACKEND_PROC=$(pm2 jlist | grep -oP '"name":"[^"]*backend[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
FRONTEND_PROC=$(pm2 jlist | grep -oP '"name":"[^"]*frontend[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

if [ -n "$BACKEND_PROC" ]; then
  log "Reiniciando backend: $BACKEND_PROC"
  pm2 restart "$BACKEND_PROC"
else
  log "ERRO: Processo backend no PM2 nao encontrado. Tentando iniciar..."
  pm2 start apps/backend/dist/main.js --name "multitenant-backend"
fi

if [ -n "$FRONTEND_PROC" ]; then
  log "Reiniciando frontend: $FRONTEND_PROC"
  pm2 restart "$FRONTEND_PROC"
else
  log "ERRO: Processo frontend no PM2 nao encontrado. Tentando iniciar..."
  pm2 start "pnpm start" --name "multitenant-frontend" --cwd "$PROJECT_ROOT/apps/frontend"
fi

pm2 save

log "Atualizacao NATIVA concluida com sucesso para a versao $RELEASE_TAG."
