#!/usr/bin/env bash
# ============================================================================
# validate-build.sh - Validação e correção automática de build Docker
# Garante que o backend NestJS inicie corretamente em containers Docker
# ============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# 1. Verificar dependências do package.json
# ============================================================================
check_package_json() {
    log_info "Verificando package.json do backend..."

    local pkg_file="$PROJECT_ROOT/apps/backend/package.json"

    if [[ ! -f "$pkg_file" ]]; then
        log_error "package.json do backend não encontrado!"
        return 1
    fi

    # Verificar se @nestjs/core está em dependencies
    if grep -q '"@nestjs/core"' "$pkg_file" && ! grep -A5 '"dependencies"' "$pkg_file" | grep -q '"@nestjs/core"'; then
        log_warn "@nestjs/core encontrado, mas não em dependencies"
        return 1
    fi

    # Verificar reflect-metadata e rxjs
    for dep in "@nestjs/common" "reflect-metadata" "rxjs"; do
        if ! grep -q "\"$dep\"" "$pkg_file"; then
            log_error "Dependência crítica não encontrada: $dep"
            return 1
        fi
    done

    log_ok "package.json verificado com sucesso"
    return 0
}

# ============================================================================
# 2. Verificar Dockerfile
# ============================================================================
check_dockerfile() {
    log_info "Verificando Dockerfile do backend..."

    local dockerfile="$PROJECT_ROOT/apps/backend/Dockerfile"

    if [[ ! -f "$dockerfile" ]]; then
        log_error "Dockerfile não encontrado!"
        return 1
    fi

    # Verificar se há COPY node_modules
    if ! grep -q "COPY.*node_modules" "$dockerfile"; then
        log_warn "Dockerfile não copia node_modules - CRÍTICO!"
        return 1
    fi

    # Verificar se há COPY dist
    if ! grep -q "COPY.*dist" "$dockerfile"; then
        log_warn "Dockerfile não copia dist - CRÍTICO!"
        return 1
    fi

    log_ok "Dockerfile verificado com sucesso"
    return 0
}

# ============================================================================
# 3. Verificar docker-compose para volumes problemáticos
# ============================================================================
check_docker_compose() {
    log_info "Verificando docker-compose.prod.external.yml..."

    local compose_file="$PROJECT_ROOT/docker-compose.prod.external.yml"

    if [[ ! -f "$compose_file" ]]; then
        log_error "docker-compose.prod.external.yml não encontrado!"
        return 1
    fi

    # Verificar se há bind mount problemático
    if grep -qE "volumes:.*:\s*\./\s*$" "$compose_file"; then
        log_error "Bind mount problemático encontrado: ./"
        return 1
    fi

    # Verificar healthcheck
    if ! grep -q "healthcheck" "$compose_file"; then
        log_warn "docker-compose não tem healthcheck - adicionando..."
        return 1
    fi

    log_ok "docker-compose verificado com sucesso"
    return 0
}

# ============================================================================
# 4. Limpar Docker antigo
# ============================================================================
cleanup_docker() {
    log_info "Limpando Docker antigo..."

    # Parar containers
    cd "$PROJECT_ROOT"
    docker compose down -v 2>/dev/null || true

    # Remover imagens antigas
    docker rmi multitenant-backend:latest 2>/dev/null || true
    docker rmi multitenant-frontend:latest 2>/dev/null || true

    # Limpar sistema
    docker system prune -af 2>/dev/null || true

    log_ok "Docker limpo com sucesso"
    return 0
}

# ============================================================================
# 5. Build sem cache
# ============================================================================
build_clean() {
    log_info "Build limpo (sem cache)..."

    cd "$PROJECT_ROOT"

    # Build backend
    docker compose build --no-cache backend || {
        log_error "Build do backend falhou!"
        return 1
    }

    # Build frontend
    docker compose build --no-cache frontend || {
        log_error "Build do frontend falhou!"
        return 1
    }

    log_ok "Build limpo concluído"
    return 0
}

# ============================================================================
# 6. Validar container iniciado
# ============================================================================
validate_container() {
    log_info "Validando container do backend..."

    local container_name="multitenant-backend-1"

    # Aguardar container iniciar
    local max_attempts=30
    local attempt=0

    while [[ $attempt -lt $max_attempts ]]; do
        if docker ps --format '{{.Names}}' | grep -q "$container_name"; then
            local status
            status=$(docker inspect -f '{{.State.Status}}' "$container_name" 2>/dev/null || echo "unknown")
            if [[ "$status" == "running" ]]; then
                break
            fi
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    # Verificar logs
    local logs
    logs=$(docker logs "$container_name" 2>&1 | tail -20 || true)

    if echo "$logs" | grep -q "Cannot find module"; then
        log_error "Módulo não encontrado nos logs!"
        echo "$logs"
        return 1
    fi

    if echo "$logs" | grep -q "ModuleNotFoundError"; then
        log_error "ModuleNotFoundError encontrado!"
        echo "$logs"
        return 1
    fi

    log_ok "Container validado com sucesso"
    return 0
}

# ============================================================================
# MAIN
# ============================================================================
main() {
    echo ""
    echo "=============================================="
    echo "  Validação e Correção de Build Docker       "
    echo "=============================================="
    echo ""

    local failed=0

    # Executar validações
    check_package_json || failed=1
    check_dockerfile || failed=1
    check_docker_compose || failed=1

    if [[ $failed -eq 1 ]]; then
        log_error "Validações falharam! Corrija os problemas acima."
        exit 1
    fi

    # Limpar e rebuild
    cleanup_docker
    build_clean

    # Validar
    validate_container || {
        log_error "Validação final falhou!"
        exit 1
    }

    echo ""
    log_ok "=============================================="
    log_ok "  BUILD VALIDADO COM SUCESSO!                 "
    log_ok "=============================================="
}

main "$@"
