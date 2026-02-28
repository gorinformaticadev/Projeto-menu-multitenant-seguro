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
#   INSTALL_DOMAIN, LETSENCRYPT_EMAIL, IMAGE_OWNER, IMAGE_REPO, IMAGE_TAG, INSTALL_ADMIN_EMAIL,
#   INSTALL_ADMIN_PASSWORD, DB_USER, DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY
# =============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_PROD="$PROJECT_ROOT/docker-compose.prod.yml"
COMPOSE_PROD_BUILD="$PROJECT_ROOT/docker-compose.prod.build.yml"
COMPOSE_EXTERNAL="$PROJECT_ROOT/docker-compose.external-nginx.yml"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
ENV_INSTALLER_EXAMPLE="$SCRIPT_DIR/.env.installer.example"
# Arquivo de env da stack de produção (monorepo: não usar .env na raiz)
ENV_PRODUCTION="$SCRIPT_DIR/.env.production"
NGINX_TEMPLATE_DOCKER="$SCRIPT_DIR/nginx-docker.conf.template"
NGINX_TEMPLATE_ACME="$PROJECT_ROOT/multitenant-docker-acme/confs/nginx-multitenant.conf"
NGINX_CONF_DIR="$PROJECT_ROOT/nginx/conf.d"
NGINX_CERTS_DIR="$PROJECT_ROOT/nginx/certs"
NGINX_WEBROOT="$PROJECT_ROOT/nginx/webroot"

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
  cert      Obtém ou renova certificado Let's Encrypt (usa install/.env.production).

Opções para install:
  -d, --domain DOMAIN       Domínio principal (ex: app.exemplo.com.br).
  -e, --email EMAIL         Email para Let's Encrypt e admin.
  -u, --image-owner OWNER   Owner no GHCR (ex: gorinformatica).
  -r, --image-repo REPO     Prefixo das imagens no GHCR (default: projeto-menu-multitenant-seguro).
  -t, --image-tag TAG       Tag da imagem (default: latest).
  -l, --local-build-only    Ignora pull de imagens e faz build local no servidor.
  -a, --admin-email EMAIL   Email do administrador (default: mesmo de -e).
  -p, --admin-pass SENHA    Senha inicial do admin (default: 123456).
  -n, --no-prompt           Não perguntar; usa apenas variáveis de ambiente.
  -c, --clean               Remove volumes existentes antes de instalar (instalação limpa).

Variáveis de ambiente (alternativa às opções):
  INSTALL_DOMAIN, LETSENCRYPT_EMAIL, IMAGE_OWNER, IMAGE_REPO, IMAGE_TAG,
  LOCAL_BUILD_ONLY,
  INSTALL_ADMIN_EMAIL, INSTALL_ADMIN_PASSWORD,
  DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, ENCRYPTION_KEY

Exemplos:
  sudo bash install/install.sh install -d menu.empresa.com -e admin@empresa.com -u gorinformatica -r projeto-menu-multitenant-seguro -t v1.0.0
  sudo bash install/install.sh install -d dev.empresa.com -e admin@empresa.com -l
  sudo INSTALL_DOMAIN=app.empresa.com LETSENCRYPT_EMAIL=admin@empresa.com bash install/install.sh install --no-prompt
  sudo bash install/install.sh update
  sudo bash install/install.sh update dev
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
    # Verificar se o Docker está instalado mas não no PATH
    if systemctl is-active --quiet docker 2>/dev/null; then
        log_info "Docker já está instalado e rodando."
        log_info "Docker: $(docker --version 2>/dev/null || echo 'instalado')"
        return 0
    fi
    
    if ! command -v docker &>/dev/null; then
        # Verificar se o Docker está instalado mas o serviço não está rodando
        if systemctl list-unit-files | grep -q docker.service; then
            log_info "Docker instalado. Iniciando serviço..."
            systemctl start docker
            systemctl enable docker
            log_info "Docker: $(docker --version)"
            return 0
        fi
        
        log_warn "Docker não encontrado. Instalando Docker..."
        install_docker
    else
        log_info "Docker: $(docker --version)"
    fi
}

install_docker() {
    log_info "Instalando Docker..."
    
    # Atualizar repositórios
    apt-get update -qq
    
    # Instalar dependências
    apt-get install -y -qq \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Adicionar chave GPG oficial do Docker
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Adicionar repositório do Docker
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Instalar Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Iniciar e habilitar Docker
    systemctl start docker
    systemctl enable docker
    
    log_info "Docker instalado com sucesso: $(docker --version)"
}

check_docker_compose() {
    if ! docker compose version &>/dev/null; then
        log_error "Docker Compose (plugin) não encontrado."
        log_error "Isso é estranho, pois deveria ter sido instalado com o Docker."
        log_error "Tente reinstalar o Docker manualmente."
        exit 1
    fi
    log_info "Docker Compose: $(docker compose version --short)"
}

check_and_open_ports() {
    log_info "Verificando portas 80 e 443..."
    
    # Instalar net-tools se necessário (para netstat)
    if ! command -v netstat &>/dev/null; then
        apt-get install -y -qq net-tools >/dev/null 2>&1 || true
    fi
    
    # Verificar se ufw está instalado e ativo
    if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
        log_info "UFW detectado. Liberando portas 80 e 443..."
        ufw allow 80/tcp >/dev/null 2>&1 || true
        ufw allow 443/tcp >/dev/null 2>&1 || true
        log_info "Portas liberadas no UFW."
    fi
    
    # Verificar se iptables está bloqueando
    if command -v iptables &>/dev/null; then
        # Verificar se há regras que bloqueiam as portas
        if iptables -L INPUT -n 2>/dev/null | grep -q "DROP\|REJECT"; then
            log_warn "Detectadas regras de firewall. Certifique-se de que as portas 80 e 443 estão liberadas."
        fi
    fi
    
    # Verificar se as portas estão em uso
    if command -v netstat &>/dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":80 "; then
            local port80_process=$(netstat -tlnp 2>/dev/null | grep ":80 " | awk '{print $7}' | head -1)
            if [[ "$port80_process" != *"docker"* ]]; then
                log_warn "Porta 80 já está em uso por: $port80_process"
                log_warn "Isso pode causar conflitos. Considere parar o serviço antes de continuar."
            fi
        fi
        
        if netstat -tlnp 2>/dev/null | grep -q ":443 "; then
            local port443_process=$(netstat -tlnp 2>/dev/null | grep ":443 " | awk '{print $7}' | head -1)
            if [[ "$port443_process" != *"docker"* ]]; then
                log_warn "Porta 443 já está em uso por: $port443_process"
                log_warn "Isso pode causar conflitos. Considere parar o serviço antes de continuar."
            fi
        fi
    fi
    
    log_info "Verificação de portas concluída."
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
    if [[ ! -f "$ENV_PRODUCTION" ]]; then
        if [[ -f "$ENV_INSTALLER_EXAMPLE" ]]; then
            cp "$ENV_INSTALLER_EXAMPLE" "$ENV_PRODUCTION"
            log_info "Arquivo de produção criado: install/.env.production"
        elif [[ -f "$ENV_EXAMPLE" ]]; then
            cp "$ENV_EXAMPLE" "$ENV_PRODUCTION"
            log_info "Arquivo de produção criado: install/.env.production"
        else
            log_error "Nenhum .env.example ou .env.installer.example encontrado."
            exit 1
        fi
    fi
}

upsert_env() {
    local key="$1"
    local value="$2"
    local file="${3:-$ENV_PRODUCTION}"
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

resolve_image_owner() {
    local owner="${IMAGE_OWNER:-${GHCR_OWNER:-}}"
    if [[ -n "$owner" ]]; then
        echo "$owner" | tr '[:upper:]' '[:lower:]'
        return 0
    fi

    if [[ -d "$PROJECT_ROOT/.git" ]]; then
        local remote_url
        remote_url="$(git -C "$PROJECT_ROOT" config --get remote.origin.url 2>/dev/null || true)"
        if [[ -n "$remote_url" ]]; then
            owner="$(echo "$remote_url" | sed -E 's#(git@github.com:|https://github.com/)##' | cut -d'/' -f1)"
            if [[ -n "$owner" ]]; then
                echo "$owner" | tr '[:upper:]' '[:lower:]'
                return 0
            fi
        fi
    fi

    echo ""
}

pull_or_build_stack() {
    local compose_base=(-f docker-compose.prod.yml)
    local compose_build=(-f docker-compose.prod.yml -f docker-compose.prod.build.yml)
    local compose_cmd=(docker compose --env-file "$ENV_PRODUCTION")
    local local_build_only="${LOCAL_BUILD_ONLY:-false}"

    print_stack_diagnostics() {
        log_warn "Falha ao subir stack. Coletando diagnóstico..."
        "${compose_cmd[@]}" "${compose_base[@]}" ps || true
        docker logs --tail 200 multitenant-backend 2>/dev/null || true
        docker logs --tail 120 multitenant-postgres 2>/dev/null || true
    }

    if [[ "$local_build_only" == "true" ]]; then
        log_info "Modo LOCAL_BUILD_ONLY=true: executando build local no servidor."
        "${compose_cmd[@]}" "${compose_build[@]}" build backend frontend
        if ! "${compose_cmd[@]}" "${compose_build[@]}" up -d; then
            print_stack_diagnostics
            return 1
        fi
        return 0
    fi

    # Primeira tentativa: pull da tag definida
    if "${compose_cmd[@]}" "${compose_base[@]}" pull; then
        if "${compose_cmd[@]}" "${compose_base[@]}" up -d; then
            return 0
        fi
        print_stack_diagnostics
        log_warn "Pull funcionou, mas os containers não ficaram saudáveis."
    fi

    # Segunda tentativa: se tag começar com v, tenta sem o prefixo v
    if [[ "${IMAGE_TAG:-}" =~ ^v[0-9] ]]; then
        local fallback_tag="${IMAGE_TAG#v}"
        log_warn "Pull falhou para tag ${IMAGE_TAG}. Tentando tag ${fallback_tag}..."
        upsert_env "IMAGE_TAG" "$fallback_tag" "$ENV_PRODUCTION"
        IMAGE_TAG="$fallback_tag"
        if "${compose_cmd[@]}" "${compose_base[@]}" pull; then
            if "${compose_cmd[@]}" "${compose_base[@]}" up -d; then
                return 0
            fi
            print_stack_diagnostics
            log_warn "Tag ${fallback_tag} foi baixada, mas os containers não ficaram saudáveis."
        fi
    fi

    log_warn "Imagem não encontrada no registry. Iniciando build local..."
    "${compose_cmd[@]}" "${compose_build[@]}" build backend frontend
    if ! "${compose_cmd[@]}" "${compose_build[@]}" up -d; then
        print_stack_diagnostics
        return 1
    fi
}

# --- Certificado Let's Encrypt ---
obtain_letsencrypt_cert() {
    local domain="$1"
    local email="$2"
    mkdir -p "$NGINX_WEBROOT"
    log_info "Obtendo certificado Let's Encrypt para $domain ..."
    # Tentar primeiro com --test-cert para não queimar limite se houver erro de DNS/Porta
    log_info "Testando conexão para Let's Encrypt (staging)..."
    if docker run --rm \
        -v "${NGINX_WEBROOT}:/var/www/certbot:rw" \
        -v "${NGINX_CERTS_DIR}:/etc/letsencrypt:rw" \
        certbot/certbot certonly --webroot \
        -w /var/www/certbot \
        -d "$domain" \
        --email "$email" \
        --agree-tos \
        --test-cert \
        --non-interactive; then
        
        log_info "Teste de staging OK. Solicitando certificado real..."
        if docker run --rm \
            -v "${NGINX_WEBROOT}:/var/www/certbot:rw" \
            -v "${NGINX_CERTS_DIR}:/etc/letsencrypt:rw" \
            certbot/certbot certonly --webroot \
            -w /var/www/certbot \
            -d "$domain" \
            --email "$email" \
            --agree-tos \
            --force-renewal \
            --non-interactive; then
            log_info "Certificado real obtido com sucesso."
        fi
        
        local live_cert="$NGINX_CERTS_DIR/live/$domain/fullchain.pem"
        local live_key="$NGINX_CERTS_DIR/live/$domain/privkey.pem"
        if [[ -f "$live_cert" ]] && [[ -f "$live_key" ]]; then
            cp "$live_cert" "$NGINX_CERTS_DIR/cert.pem"
            cp "$live_key" "$NGINX_CERTS_DIR/key.pem"
            log_info "Certificado Let's Encrypt instalado em nginx/certs/"
            cd "$PROJECT_ROOT"
            docker compose --env-file "$ENV_PRODUCTION" -f docker-compose.prod.yml restart nginx 2>/dev/null || true
            return 0
        fi
    fi
    log_warn "Não foi possível obter certificado Let's Encrypt (verifique DNS e porta 80). Mantido certificado autoassinado."
    return 1
}

# --- Instalação inicial ---
run_install() {
    local domain="${INSTALL_DOMAIN:-}"
    local email="${LETSENCRYPT_EMAIL:-}"
    local image_owner="${IMAGE_OWNER:-}"
    local image_repo="${IMAGE_REPO:-projeto-menu-multitenant-seguro}"
    local image_tag="${IMAGE_TAG:-latest}"
    local local_build_only="${LOCAL_BUILD_ONLY:-false}"
    local admin_email="${INSTALL_ADMIN_EMAIL:-$email}"
    local admin_pass="${INSTALL_ADMIN_PASSWORD:-123456}"
    local no_prompt="${INSTALL_NO_PROMPT:-false}"
    local clean_install="${CLEAN_INSTALL:-false}"

    # Parse opções
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -d|--domain)   domain="$2"; shift 2 ;;
            -e|--email)    email="$2"; shift 2 ;;
            -u|--image-owner) image_owner="$2"; shift 2 ;;
            -r|--image-repo) image_repo="$2"; shift 2 ;;
            -t|--image-tag) image_tag="$2"; shift 2 ;;
            -l|--local-build-only) local_build_only="true"; shift ;;
            -a|--admin-email)  admin_email="$2"; shift 2 ;;
            -p|--admin-pass)   admin_pass="$2"; shift 2 ;;
            -n|--no-prompt)   no_prompt="true"; shift ;;
            -c|--clean)   clean_install="true"; shift ;;
            *) shift ;;
        esac
    done

    if [[ "$no_prompt" != "true" ]]; then
        [[ -z "$domain" ]] && read -p "Domínio (ex: app.empresa.com): " domain
        [[ -z "$email" ]]  && read -p "Email (Let's Encrypt / admin): " email
        if [[ -z "$image_owner" && "$local_build_only" != "true" ]]; then
            read -p "GHCR owner (ex: org/user): " image_owner
        fi
        [[ -z "$image_repo" ]] && read -p "Image repo prefix [projeto-menu-multitenant-seguro]: " image_repo
        image_repo="${image_repo:-projeto-menu-multitenant-seguro}"
        [[ -z "$image_tag" ]] && image_tag="latest"
        [[ -z "$admin_email" ]] && admin_email="$email"
        read -sp "Senha inicial do admin [123456]: " admin_pass
        echo
        admin_pass="${admin_pass:-123456}"
    fi

    if [[ -z "$image_owner" && "$local_build_only" != "true" ]]; then
        image_owner="$(resolve_image_owner)"
    fi

    if [[ -z "$domain" || -z "$email" ]]; then
        log_error "Domínio e email são obrigatórios."
        show_usage
        exit 1
    fi
    if [[ "$local_build_only" != "true" && -z "$image_owner" ]]; then
        log_error "IMAGE_OWNER é obrigatório quando LOCAL_BUILD_ONLY=false."
        show_usage
        exit 1
    fi
    validate_email "$email"
    [[ -n "$admin_email" ]] && validate_email "$admin_email"

    image_owner="${image_owner:-local-build}"
    image_owner="$(echo "$image_owner" | tr '[:upper:]' '[:lower:]')"
    image_repo="$(echo "$image_repo" | tr '[:upper:]' '[:lower:]')"
    local_build_only="$(echo "$local_build_only" | tr '[:upper:]' '[:lower:]')"
    LOCAL_BUILD_ONLY="$local_build_only"
    ensure_env_file

    # Carregar env existente para recuperar credenciais já criadas
    if [[ -f "$ENV_PRODUCTION" ]]; then
        set -a
        source "$ENV_PRODUCTION" 2>/dev/null || true
        set +a
    fi

    # Limpar volumes se solicitado
    if [[ "$clean_install" == "true" ]]; then
        log_warn "Limpeza solicitada: removendo containers e volumes existentes..."
        cd "$PROJECT_ROOT"
        docker compose --env-file "$ENV_PRODUCTION" -f docker-compose.prod.yml down -v 2>/dev/null || true
        log_info "Volumes removidos. Iniciando instalação limpa..."
    fi

    # Gerar prefixo baseado no domínio (remove pontos e pega a parte principal)
    # Ex: novo.whapichat.com.br -> novowhapichat
    local domain_prefix=$(echo "$domain" | sed 's/\..*//')
    if [[ "$domain" == *"."* ]]; then
        # Se tiver subdomínio, tenta pegar o nome principal também
        # Ex: novo.whapichat.com.br -> novowhapichat
        domain_prefix=$(echo "$domain" | cut -d'.' -f1,2 | tr -d '.')
    fi
    # Sanitizar para garantir apenas letras e números, max 16 caracteres
    domain_prefix=$(echo "$domain_prefix" | tr -cd '[:alnum:]' | cut -c1-16 | tr '[:upper:]' '[:lower:]')
    
    # Secrets gerados se não fornecidos
    local db_name="${DB_NAME:-db_${domain_prefix}}"
    local db_user="${DB_USER:-us_${domain_prefix}}"
    local db_pass="${DB_PASSWORD:-$(openssl rand -hex 16)}"
    local jwt_secret="${JWT_SECRET:-$(openssl rand -hex 32)}"
    local enc_key="${ENCRYPTION_KEY:-$(openssl rand -hex 32)}"

    log_info "Configurando .env..."
    upsert_env "DOMAIN" "$domain"
    upsert_env "LETSENCRYPT_EMAIL" "$email"
    upsert_env "LETSENCRYPT_HOST" "$domain"
    upsert_env "VIRTUAL_HOST" "$domain"
    upsert_env "IMAGE_OWNER" "$image_owner"
    upsert_env "IMAGE_REPO" "$image_repo"
    upsert_env "IMAGE_TAG" "$image_tag"
    upsert_env "LOCAL_BUILD_ONLY" "$local_build_only"
    upsert_env "FRONTEND_URL" "https://$domain"
    upsert_env "NEXT_PUBLIC_API_URL" "https://$domain/api"
    
    # Garantir que variáveis de imagem sejam substituídas se o .env.production veio de um template
    sed -i "s/__IMAGE_OWNER__/$image_owner/g" "$ENV_PRODUCTION"
    sed -i "s/__IMAGE_REPO__/$image_repo/g" "$ENV_PRODUCTION"
    sed -i "s/__IMAGE_TAG__/$image_tag/g" "$ENV_PRODUCTION"

    upsert_env "DB_USER" "$db_user"
    upsert_env "DB_PASSWORD" "$db_pass"
    upsert_env "DB_NAME" "$db_name"
    upsert_env "DATABASE_URL" "postgresql://$db_user:$db_pass@db:5432/$db_name?schema=public"
    upsert_env "JWT_SECRET" "$jwt_secret"
    upsert_env "ENCRYPTION_KEY" "$enc_key"
    upsert_env "REQUIRE_SECRET_MANAGER" "false"
    upsert_env "NODE_ENV" "production"
    upsert_env "PORT" "4000"
    # Variáveis de instalação (documentação / uso futuro pelo backend)
    upsert_env "INSTALL_DOMAIN" "$domain"
    upsert_env "INSTALL_ADMIN_EMAIL" "${admin_email:-$email}"
    upsert_env "INSTALL_ADMIN_PASSWORD" "$admin_pass"

    # Criar .env em apps/backend e .env.local em apps/frontend (a partir dos exemplos do projeto)
    BACKEND_ENV="$PROJECT_ROOT/apps/backend/.env"
    FRONTEND_ENV="$PROJECT_ROOT/apps/frontend/.env.local"
    BACKEND_EXAMPLE="$PROJECT_ROOT/apps/backend/.env.example"
    FRONTEND_EXAMPLE="$PROJECT_ROOT/apps/frontend/.env.local.example"
    if [[ -f "$BACKEND_EXAMPLE" ]]; then
        if [[ ! -f "$BACKEND_ENV" ]]; then
            cp "$BACKEND_EXAMPLE" "$BACKEND_ENV"
            log_info "Criado apps/backend/.env a partir de .env.example"
        fi
        upsert_env "DATABASE_URL" "postgresql://$db_user:$db_pass@db:5432/$db_name?schema=public" "$BACKEND_ENV"
        upsert_env "JWT_SECRET" "$jwt_secret" "$BACKEND_ENV"
        upsert_env "ENCRYPTION_KEY" "$enc_key" "$BACKEND_ENV"
        upsert_env "FRONTEND_URL" "https://$domain" "$BACKEND_ENV"
        upsert_env "PORT" "4000" "$BACKEND_ENV"
        upsert_env "NODE_ENV" "production" "$BACKEND_ENV"
        upsert_env "INSTALL_ADMIN_EMAIL" "${admin_email:-$email}" "$BACKEND_ENV"
        upsert_env "INSTALL_ADMIN_PASSWORD" "$admin_pass" "$BACKEND_ENV"
    fi
    if [[ -f "$FRONTEND_EXAMPLE" ]]; then
        if [[ ! -f "$FRONTEND_ENV" ]]; then
            cp "$FRONTEND_EXAMPLE" "$FRONTEND_ENV"
            log_info "Criado apps/frontend/.env.local a partir de .env.local.example"
        fi
        upsert_env "NEXT_PUBLIC_API_URL" "https://$domain/api" "$FRONTEND_ENV"
    fi

    # Nginx embutido (docker-compose.prod.yml): criar dirs, cert e config
    if [[ -f "$COMPOSE_PROD" ]]; then
        mkdir -p "$NGINX_CONF_DIR" "$NGINX_CERTS_DIR" "$NGINX_WEBROOT"
        # Certificado autoassinado para HTTPS (antes de escolher o template)
        if [[ ! -f "$NGINX_CERTS_DIR/cert.pem" ]] || [[ ! -f "$NGINX_CERTS_DIR/key.pem" ]]; then
            log_info "Gerando certificado autoassinado para HTTPS em $NGINX_CERTS_DIR"
            if openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$NGINX_CERTS_DIR/key.pem" \
                -out "$NGINX_CERTS_DIR/cert.pem" \
                -subj "/CN=$domain" 2>/dev/null; then
                log_info "Certificado autoassinado criado. Para produção, substitua por Let's Encrypt."
            fi
        fi
        # Template Docker: upstream frontend:5000, backend:4000 (evita 502 Bad Gateway)
        if [[ -f "$NGINX_TEMPLATE_DOCKER" ]] && [[ -f "$NGINX_CERTS_DIR/cert.pem" ]]; then
            sed "s/__DOMAIN__/$domain/g" "$NGINX_TEMPLATE_DOCKER" > "$NGINX_CONF_DIR/default.conf"
            log_info "Config Nginx gerado (HTTP + HTTPS) em $NGINX_CONF_DIR/default.conf"
        elif [[ -f "$NGINX_TEMPLATE_DOCKER" ]]; then
            NGINX_HTTP_ONLY="$SCRIPT_DIR/nginx-docker-http-only.conf.template"
            if [[ -f "$NGINX_HTTP_ONLY" ]]; then
                sed "s/__DOMAIN__/$domain/g" "$NGINX_HTTP_ONLY" > "$NGINX_CONF_DIR/default.conf"
                log_info "Config Nginx gerado (apenas HTTP) em $NGINX_CONF_DIR/default.conf"
            else
                sed "s/__DOMAIN__/$domain/g" "$NGINX_TEMPLATE_DOCKER" > "$NGINX_CONF_DIR/default.conf"
            fi
        elif [[ -f "$NGINX_TEMPLATE_ACME" ]]; then
            sed "s/__DOMAIN__/$domain/g" "$NGINX_TEMPLATE_ACME" > "$NGINX_CONF_DIR/default.conf"
            log_warn "Usando template ACME; no Docker use nginx-docker.conf.template para evitar 502."
        else
            log_warn "Nenhum template nginx encontrado. Configure manualmente $NGINX_CONF_DIR/default.conf"
        fi
    fi

    log_info "Subindo stack (docker-compose.prod.yml) com install/.env.production..."
    cd "$PROJECT_ROOT"
    pull_or_build_stack

    # Tentar obter certificado Let's Encrypt (domínio deve apontar para este host e porta 80 acessível)
    sleep 5
    if obtain_letsencrypt_cert "$domain" "$email"; then
        echogreen "Certificado SSL válido (Let's Encrypt) instalado."
    fi

    # O seed é executado automaticamente pelo docker-entrypoint.sh do backend
    # Aguardar alguns segundos para garantir que o seed foi executado
    log_info "Aguardando inicialização completa do sistema..."
    sleep 10

    # Exibir Relatório Final de Credenciais
    echo -e "\n\n"
    echoblue "=========================================================="
    echoblue "      RELATÓRIO FINAL DE INSTALAÇÃO - MULTITENANT         "
    echoblue "=========================================================="
    echo -e "\n"
    
    echo -e "\033[1;32m🌐 ACESSO AO SISTEMA:\033[0m"
    echo -e "   URL Principal:  https://$domain"
    echo -e "   API Endpoint:   https://$domain/api"
    echo -e "\n"

    echo -e "\033[1;32m👤 CREDENCIAIS DO ADMINISTRADOR:\033[0m"
    echo -e "   Email:          $admin_email"
    echo -e "   Senha:          $admin_pass"
    echo -e "   Nível:          SUPER_ADMIN"
    echo -e "\n"

    echo -e "\033[1;32m🐘 BANCO DE DADOS (PostgreSQL):\033[0m"
    echo -e "   Host:           db (interno) / localhost (se exposto)"
    echo -e "   Porta:          5432"
    echo -e "   Banco:          $db_name"
    echo -e "   Usuário:        $db_user"
    echo -e "   Senha:          $db_pass"
    echo -e "\n"

    echo -e "\033[1;32m🔴 CACHE (Redis):\033[0m"
    echo -e "   Host:           redis"
    echo -e "   Porta:          6379"
    echo -e "\n"

    echo -e "\033[1;32m🔑 SEGREDOS DO SISTEMA:\033[0m"
    echo -e "   JWT_SECRET:     $jwt_secret"
    echo -e "   ENCRYPTION_KEY: $enc_key"
    echo -e "\n"

    echoblue "=========================================================="
    log_info "Guarde estas informações em local seguro!"
    log_info "Arquivo de configuração: install/.env.production"
    echogreen "Instalação concluída com sucesso!"
    echo -e "\n"
}

# --- Atualização ---
run_update() {
    local branch="${1:-}"
    cd "$PROJECT_ROOT"

    ensure_env_file
    if [[ -f "$ENV_PRODUCTION" ]]; then
        set -a
        # shellcheck source=/dev/null
        source "$ENV_PRODUCTION" 2>/dev/null || true
        set +a
    fi

    IMAGE_OWNER="${IMAGE_OWNER:-$(resolve_image_owner)}"
    IMAGE_REPO="${IMAGE_REPO:-projeto-menu-multitenant-seguro}"
    IMAGE_TAG="${IMAGE_TAG:-latest}"
    LOCAL_BUILD_ONLY="${LOCAL_BUILD_ONLY:-false}"
    LOCAL_BUILD_ONLY="$(echo "$LOCAL_BUILD_ONLY" | tr '[:upper:]' '[:lower:]')"
    if [[ "$LOCAL_BUILD_ONLY" != "true" && -z "$IMAGE_OWNER" ]]; then
        log_error "IMAGE_OWNER não definido em install/.env.production e não foi possível inferir do git remote."
        exit 1
    fi
    IMAGE_OWNER="${IMAGE_OWNER:-local-build}"
    upsert_env "IMAGE_OWNER" "$IMAGE_OWNER" "$ENV_PRODUCTION"
    upsert_env "IMAGE_REPO" "$IMAGE_REPO" "$ENV_PRODUCTION"
    upsert_env "IMAGE_TAG" "$IMAGE_TAG" "$ENV_PRODUCTION"
    upsert_env "LOCAL_BUILD_ONLY" "$LOCAL_BUILD_ONLY" "$ENV_PRODUCTION"
    upsert_env "REQUIRE_SECRET_MANAGER" "${REQUIRE_SECRET_MANAGER:-false}" "$ENV_PRODUCTION"

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

    # Atualizar configuração nginx para refletir correções de roteamento (/uploads)
    if [[ -n "${DOMAIN:-}" ]]; then
        mkdir -p "$NGINX_CONF_DIR"
        if [[ -f "$NGINX_TEMPLATE_DOCKER" ]]; then
            sed "s/__DOMAIN__/$DOMAIN/g" "$NGINX_TEMPLATE_DOCKER" > "$NGINX_CONF_DIR/default.conf"
            log_info "Nginx default.conf atualizado com o domínio ${DOMAIN}."
        fi
    fi

    log_info "Baixando imagens..."
    pull_or_build_stack

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
    check_and_open_ports

    local cmd="${1:-}"
    shift || true
    case "$cmd" in
        install) run_install "$@" ;;
        update)  run_update "$@" ;;
        cert)    run_cert ;;
        *)       show_usage; exit 1 ;;
    esac
}

# --- Obter/renovar certificado (comando standalone) ---
run_cert() {
    cd "$PROJECT_ROOT"
    ensure_env_file
    if [[ ! -f "$ENV_PRODUCTION" ]]; then
        log_error "Crie install/.env.production antes (rode install primeiro)."
        exit 1
    fi
    set -a
    # shellcheck source=/dev/null
    source "$ENV_PRODUCTION" 2>/dev/null || true
    set +a
    domain="${DOMAIN:-}"
    email="${LETSENCRYPT_EMAIL:-}"
    if [[ -z "$domain" || -z "$email" ]]; then
        log_error "Defina DOMAIN e LETSENCRYPT_EMAIL em install/.env.production"
        exit 1
    fi
    if obtain_letsencrypt_cert "$domain" "$email"; then
        echogreen "Certificado Let's Encrypt obtido/atualizado."
    else
        exit 1
    fi
}

main "$@"
