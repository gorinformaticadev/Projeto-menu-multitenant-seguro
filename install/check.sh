#!/usr/bin/env bash
# =============================================================================
# Verificação do ambiente - Projeto Menu Multitenant
# =============================================================================
# Confere: Docker, containers, Nginx, portas 80/443 e certificados.
#
# Uso: bash install/check.sh   (a partir da raiz do projeto)
#      bash install/check.sh --json   (saída em uma linha para logs)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_PROD="$PROJECT_ROOT/docker-compose.prod.yml"
NGINX_CONF="$PROJECT_ROOT/nginx/conf.d/default.conf"
NGINX_CERTS_DIR="$PROJECT_ROOT/nginx/certs"
CERT_PEM="$NGINX_CERTS_DIR/cert.pem"
KEY_PEM="$NGINX_CERTS_DIR/key.pem"

# Containers esperados (docker-compose.prod.yml)
CONTAINERS=(multitenant-nginx multitenant-frontend multitenant-backend multitenant-postgres multitenant-redis)
PORTS_WANTED="80 443"
JSON="${1:-}"

ok()  { echo -e "\033[1;32m[OK]\033[0m $*"; }
warn() { echo -e "\033[1;33m[AVISO]\033[0m $*"; }
fail() { echo -e "\033[1;31m[FALHA]\033[0m $*" >&2; }
info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }

FIRST_JSON=1
report() {
    local status="$1"
    local msg="$2"
    local key="${3:-}"
    if [[ "$JSON" == "--json" ]]; then
        [[ $FIRST_JSON -eq 0 ]] && echo -n ","
        echo "{\"check\":\"$key\",\"status\":\"$status\",\"message\":\"$msg\"}"
        FIRST_JSON=0
    else
        [[ "$status" == "ok" ]] && ok "$msg" || fail "$msg"
    fi
}

cd "$PROJECT_ROOT"

if [[ "$JSON" == "--json" ]]; then
    echo "{\"script\":\"check.sh\",\"timestamp\":\"$(date -Iseconds)\",\"results\":["
fi

# --- 1. Docker instalado e em execução ---
if command -v docker &>/dev/null; then
    if docker info &>/dev/null; then
        report ok "Docker instalado e em execução" "docker"
    else
        report fail "Docker instalado mas o daemon não está rodando (ex: systemctl start docker)" "docker"
    fi
else
    report fail "Docker não encontrado no PATH" "docker"
fi

# --- 2. Docker Compose ---
if docker compose version &>/dev/null; then
    report ok "Docker Compose (plugin) disponível: $(docker compose version --short 2>/dev/null)" "compose"
else
    report fail "Docker Compose (plugin) não encontrado" "compose"
fi

# --- 3. Arquivo docker-compose.prod.yml ---
if [[ -f "$COMPOSE_PROD" ]]; then
    report ok "Arquivo docker-compose.prod.yml encontrado" "compose_file"
else
    report fail "Arquivo docker-compose.prod.yml não encontrado em $PROJECT_ROOT" "compose_file"
fi

# --- 4. Containers (existência e status) ---
for name in "${CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$name"; then
        state="$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null)"
        health="$(docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || echo "no-healthcheck")"
        if [[ "$state" == "running" ]]; then
            if [[ "$health" == "healthy" ]]; then
                report ok "Container $name: running, healthy" "container_$name"
            elif [[ "$health" == "no-healthcheck" || -z "$health" ]]; then
                report ok "Container $name: running (sem healthcheck)" "container_$name"
            else
                report fail "Container $name: running mas health=$health" "container_$name"
            fi
        else
            report fail "Container $name: estado=$state" "container_$name"
        fi
    else
        report fail "Container $name não existe (não foi criado)" "container_$name"
    fi
done

# --- 5. Nginx: config ---
if [[ -f "$NGINX_CONF" ]]; then
    report ok "Nginx: arquivo de config existe ($NGINX_CONF)" "nginx_config"
else
    report fail "Nginx: config não encontrada ($NGINX_CONF)" "nginx_config"
fi

# --- 6. Portas 80 e 443 em escuta ---
for port in 80 443; do
    if command -v ss &>/dev/null; then
        if ss -tlnp 2>/dev/null | grep -q ":$port "; then
            report ok "Porta $port está em escuta" "port_$port"
        else
            report fail "Porta $port não está em escuta" "port_$port"
        fi
    elif command -v netstat &>/dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            report ok "Porta $port está em escuta" "port_$port"
        else
            report fail "Porta $port não está em escuta" "port_$port"
        fi
    else
        if docker ps --format '{{.Names}}' | grep -qx multitenant-nginx; then
            report ok "Porta $port: container nginx rodando (não foi possível verificar ss/netstat)" "port_$port"
        else
            report fail "Porta $port: não foi possível verificar (instale ss ou netstat)" "port_$port"
        fi
    fi
done

# --- 7. Certificados SSL ---
if [[ -f "$CERT_PEM" ]] && [[ -f "$KEY_PEM" ]]; then
    if openssl x509 -in "$CERT_PEM" -noout -subject 2>/dev/null >/dev/null; then
        report ok "Certificado SSL: cert.pem e key.pem existem e são válidos" "ssl_certs"
    else
        report fail "Certificado: arquivos existem mas cert.pem inválido" "ssl_certs"
    fi
else
    report fail "Certificado: faltando cert.pem ou key.pem em nginx/certs/" "ssl_certs"
fi

# --- 8. Resumo rápido (tabela) ---
if [[ -z "$JSON" ]]; then
    echo ""
    info "--- Resumo dos containers (docker compose ps) ---"
    if [[ -f "$COMPOSE_PROD" ]]; then
        ENV_FILE="$SCRIPT_DIR/.env.production"
        if [[ -f "$ENV_FILE" ]]; then
            (cd "$PROJECT_ROOT" && docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml ps 2>/dev/null) || true
        else
            (cd "$PROJECT_ROOT" && docker compose -f docker-compose.prod.yml ps 2>/dev/null) || true
        fi
    fi
    echo ""
    info "--- Portas em escuta (80, 443) ---"
    (ss -tlnp 2>/dev/null | grep -E ':80 |:443 ') || (netstat -tlnp 2>/dev/null | grep -E ':80 |:443 ') || echo "  (ss/netstat indisponível)"
    echo ""
    info "--- Teste rápido HTTP (localhost:80) ---"
    if curl -sf -o /dev/null --connect-timeout 2 http://127.0.0.1:80/ 2>/dev/null; then
        ok "curl http://127.0.0.1:80/ respondeu com sucesso"
    else
        fail "curl http://127.0.0.1:80/ falhou ou não respondeu"
    fi
    info "--- Teste rápido HTTPS (localhost:443) ---"
    if curl -sfk -o /dev/null --connect-timeout 2 https://127.0.0.1:443/ 2>/dev/null; then
        ok "curl https://127.0.0.1:443/ respondeu (certificado pode ser autoassinado)"
    else
        warn "curl https://127.0.0.1:443/ falhou ou não respondeu"
    fi
fi

if [[ "$JSON" == "--json" ]]; then
    echo "]}"
fi
