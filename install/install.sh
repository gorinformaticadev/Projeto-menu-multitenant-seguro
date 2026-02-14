#!/usr/bin/env bash
# =============================================================================
# Instalador automatizado - Projeto Menu Multitenant (Monorepo)
# =============================================================================
# Baseado na estrutura multitenant-docker-acme. Compatível com CI/CD e cenário
# multitenant. Suporta instalação inicial e rotina de atualização.
#
# Uso:
#   Instalação:  sudo bash install/install.sh install [opções]
#   Atualização: sudo bash install/install.sh update [branch]
#
# Variáveis de instalação (podem ser passadas por ambiente ou interativamente):
#   INSTALL_DOMAIN, LETSENCRYPT_EMAIL, DOCKERHUB_USERNAME, INSTALL_ADMIN_EMAIL,
#   INSTALL_ADMIN_PASSWORD, DB_USER, DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY
# =============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_PROD="$PROJECT_ROOT/docker-compose.prod.yml"
COMPOSE_EXTERNAL="$PROJECT_ROOT/docker-compose.external-nginx.yml"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
ENV_INSTALLER_EXAMPLE="$SCRIPT_DIR/.env.installer.example"
NGINX_TEMPLATE="$PROJECT_ROOT/multitenant-docker-acme/confs/nginx-multitenant.conf"
NGINX_CONF_DIR="$PROJECT_ROOT/nginx/conf.d"
NGINX_CERTS_DIR="$PROJECT_ROOT/nginx/certs"

# --- Cores e helpers ---
echored()   { echo -ne "\033[41m\033[37m\033[1m  $1  \033[0m\n"; }
echoblue()  { echo -ne "\033[44m\033[37m\033[1m  $1  \033[0m\n"; }
echogreen() { echo -ne "\033[42m\033[37m\033[1m  $1  \033[0m\n"; }
log_info()  { echo -e "\033[1;34m[INFO]\033[0m $*"; }
log_warn()  { echo -e "\033[1;33m[WARN]\033[0m $*"; }
log_error() { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

cleanup_on_error() {
    log_error "Instalador interrompido. Verifique as mensagens acima."
    exit 1
}
trap cleanup_on_error ERR

# --- Uso ---
show_usage() {
    cat <<'EOF'
Uso:
  sudo bash install/install.sh install [OPÇÕES]
  sudo bash install/install.sh update [branch]

Comandos:
  install   Instalação inicial (cria .env, prepara nginx, sobe containers).
  update    Atualização (pull imagens, reinicia containers).

Opções para install:
  -d, --domain DOMAIN       Domínio principal (ex: app.exemplo.com.br).
  -e, --email EMAIL         Email para Let's Encrypt e admin.
  -u, --docker-user USER    Usuário Docker Hub para imagens (ex: gorinformaticadev).
  -a, --admin-email EMAIL   Email do administrador (default: mesmo de -e).
  -p, --admin-pass SENHA    Senha inicial do admin (default: 123456).
  -n, --no-prompt           Não perguntar; usa apenas variáveis de ambiente.

Variáveis de ambiente (alternativa às opções):
  INSTALL_DOMAIN, LETSENCRYPT_EMAIL, DOCKERHUB_USERNAME,
  INSTALL_ADMIN_EMAIL, INSTALL_ADMIN_PASSWORD,
  DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, ENCRYPTION_KEY

Exemplos:
  sudo bash install/install.sh install -d menu.empresa.com -e admin@empresa.com -u gorinformaticadev
  sudo INSTALL_DOMAIN=app.empresa.com LETSENCRYPT_EMAIL=admin@empresa.com bash install/install.sh install --no-prompt
  sudo bash install/install.sh update
  sudo bash install/install.sh update develop
EOF
}

# --- Verificações de dependências ---
require_bash() {
    if [[ -z "${BASH_VERSION:-}" ]]; then
        echored "Este script deve ser executado com Bash."
        exit 1
    fi
}

require_root() {
    if [[ $EUID -ne 0 ]]; then
        echored "Este script deve ser executado como root (sudo)."
        exit 1
    fi
}

check_docker() {
    if ! command -v docker &>/dev/null; then
        log_info "Docker não encontrado. Instalando..."
        curl -fsSL https://get.docker.com | sh
        log_info "Docker instalado."
    else
        log_info "Docker: $(docker --version)"
    fi
}

check_docker_compose() {
    if ! docker compose version &>/dev/null; then
        log_error "Docker Compose (plugin) não encontrado."
        log_error "Instale com: apt-get update && apt-get install -y docker-compose-plugin"
        exit 1
    fi
    log_info "Docker Compose: $(docker compose version --short)"
}

# --- Validações ---
validate_email() {
    local email="$1"
    local re="^[a-z0-9!#\$%&'*+/=?^_\`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_\`{|}~-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?\$"
    if ! [[ "$email" =~ $re ]]; then
        log_error "Email inválido: $email"
        exit 1
    fi
}

ensure_env_file() {
    if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
        if [[ -f "$ENV_INSTALLER_EXAMPLE" ]]; then
            cp "$ENV_INSTALLER_EXAMPLE" "$PROJECT_ROOT/.env"
            log_info "Arquivo .env criado a partir de .env.installer.example"
        elif [[ -f "$ENV_EXAMPLE" ]]; then
            cp "$ENV_EXAMPLE" "$PROJECT_ROOT/.env"
            log_info "Arquivo .env criado a partir de .env.example"
        else
            log_error "Nenhum .env.example ou .env.installer.example encontrado."
            exit 1
        fi
    fi
}

upsert_env() {
    local key="$1"
    local value="$2"
    local file="${3:-$PROJECT_ROOT/.env}"
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        local tmpfile
        tmpfile="$(mktemp)"
        while IFS= read -r line; do
            if [[ "$line" == "${key}="* ]]; then
                echo "${key}=${value}"
            else
                echo "$line"
            fi
        done < "$file" > "$tmpfile"
        mv "$tmpfile" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# --- Instalação inicial ---
run_install() {
    local domain="${INSTALL_DOMAIN:-}"
    local email="${LETSENCRYPT_EMAIL:-}"
    local docker_user="${DOCKERHUB_USERNAME:-}"
    local admin_email="${INSTALL_ADMIN_EMAIL:-$email}"
    local admin_pass="${INSTALL_ADMIN_PASSWORD:-123456}"
    local no_prompt="${INSTALL_NO_PROMPT:-false}"

    # Parse opções
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -d|--domain)   domain="$2"; shift 2 ;;
            -e|--email)    email="$2"; shift 2 ;;
            -u|--docker-user) docker_user="$2"; shift 2 ;;
            -a|--admin-email)  admin_email="$2"; shift 2 ;;
            -p|--admin-pass)   admin_pass="$2"; shift 2 ;;
            -n|--no-prompt)   no_prompt="true"; shift ;;
            *) shift ;;
        esac
    done

    if [[ "$no_prompt" != "true" ]]; then
        [[ -z "$domain" ]] && read -p "Domínio (ex: app.empresa.com): " domain
        [[ -z "$email" ]]  && read -p "Email (Let's Encrypt / admin): " email
        [[ -z "$docker_user" ]] && read -p "Docker Hub username (imagens): " docker_user
        [[ -z "$admin_email" ]] && admin_email="$email"
        read -sp "Senha inicial do admin [123456]: " admin_pass
        echo
        admin_pass="${admin_pass:-123456}"
    fi

    if [[ -z "$domain" || -z "$email" ]]; then
        log_error "Domínio e email são obrigatórios."
        show_usage
        exit 1
    fi
    validate_email "$email"
    [[ -n "$admin_email" ]] && validate_email "$admin_email"

    docker_user="${docker_user:-local}"
    ensure_env_file

    # Secrets gerados se não fornecidos
    local db_user="${DB_USER:-multitenant}"
    local db_pass="${DB_PASSWORD:-$(openssl rand -hex 16)}"
    local db_name="${DB_NAME:-multitenant}"
    local jwt_secret="${JWT_SECRET:-$(openssl rand -hex 32)}"
    local enc_key="${ENCRYPTION_KEY:-$(openssl rand -hex 32)}"

    log_info "Configurando .env..."
    upsert_env "DOMAIN" "$domain"
    upsert_env "LETSENCRYPT_EMAIL" "$email"
    upsert_env "LETSENCRYPT_HOST" "$domain"
    upsert_env "VIRTUAL_HOST" "$domain"
    upsert_env "DOCKERHUB_USERNAME" "$docker_user"
    upsert_env "FRONTEND_URL" "https://$domain"
    upsert_env "NEXT_PUBLIC_API_URL" "https://$domain/api"
    upsert_env "DB_USER" "$db_user"
    upsert_env "DB_PASSWORD" "$db_pass"
    upsert_env "DB_NAME" "$db_name"
    upsert_env "DATABASE_URL" "postgresql://$db_user:$db_pass@db:5432/$db_name?schema=public"
    upsert_env "JWT_SECRET" "$jwt_secret"
    upsert_env "ENCRYPTION_KEY" "$enc_key"
    upsert_env "NODE_ENV" "production"
    upsert_env "PORT" "4000"
    # Variáveis de instalação (documentação / uso futuro pelo backend)
    upsert_env "INSTALL_DOMAIN" "$domain"
    upsert_env "INSTALL_ADMIN_EMAIL" "${admin_email:-$email}"
    upsert_env "INSTALL_ADMIN_PASSWORD" "$admin_pass"

    # Nginx embutido (docker-compose.prod.yml): criar dirs e config
    if [[ -f "$COMPOSE_PROD" ]]; then
        mkdir -p "$NGINX_CONF_DIR" "$NGINX_CERTS_DIR"
        if [[ -f "$NGINX_TEMPLATE" ]]; then
            sed "s/__DOMAIN__/$domain/g" "$NGINX_TEMPLATE" > "$NGINX_CONF_DIR/default.conf"
            log_info "Config Nginx gerado em $NGINX_CONF_DIR/default.conf"
        else
            log_warn "Template nginx não encontrado em $NGINX_TEMPLATE. Certificados e conf devem ser configurados manualmente."
        fi
    fi

    log_info "Subindo stack (docker-compose.prod.yml)..."
    cd "$PROJECT_ROOT"
    if ! docker compose -f docker-compose.prod.yml pull; then
        log_warn "Pull de imagens falhou (talvez imagens locais). Continuando..."
    fi
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    if ! docker compose -f docker-compose.prod.yml up -d; then
        log_error "Falha ao subir containers."
        exit 1
    fi

    echogreen "Instalação concluída."
    echo ""
    log_info "URL: https://$domain"
    log_info "Admin: $admin_email / $admin_pass"
    log_info "Altere a senha após o primeiro login."
    echo ""
}

# --- Atualização ---
run_update() {
    local branch="${1:-}"
    cd "$PROJECT_ROOT"

    ensure_env_file
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        set -a
        # shellcheck source=/dev/null
        source "$PROJECT_ROOT/.env" 2>/dev/null || true
        set +a
    fi

    if [[ -d "$PROJECT_ROOT/.git" ]] && [[ -n "$branch" ]]; then
        log_info "Atualizando repositório (branch: ${branch})..."
        git fetch --all
        if git rev-parse --verify "$branch" &>/dev/null; then
            git checkout "$branch"
        else
            git checkout --track "origin/$branch" 2>/dev/null || git checkout "$branch"
        fi
        git pull origin "$branch" || true
    fi

    log_info "Baixando imagens..."
    if ! docker compose -f docker-compose.prod.yml pull; then
        log_warn "Pull falhou; usando imagens existentes."
    fi
    log_info "Reiniciando containers..."
    docker compose -f docker-compose.prod.yml down
    docker compose -f docker-compose.prod.yml up -d

    echogreen "Atualização concluída."
}

# --- Main ---
main() {
    require_bash
    require_root

    echoblue "=============================================="
    echoblue "  Projeto Menu Multitenant - Instalador      "
    echoblue "=============================================="
    echo ""

    check_docker
    check_docker_compose

    local cmd="${1:-}"
    shift || true
    case "$cmd" in
        install) run_install "$@" ;;
        update)  run_update "$@" ;;
        *)       show_usage; exit 1 ;;
    esac
}

main "$@"
