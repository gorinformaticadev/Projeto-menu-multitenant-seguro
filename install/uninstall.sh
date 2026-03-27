#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

# ==========================================================
# Uninstaller - Projeto Menu Multitenant
# ==========================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/.env.production"
NATIVE_SYSTEM_USER="multitenant"
NATIVE_BASE_DIR="/home/${NATIVE_SYSTEM_USER}"

require_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Execute como root (sudo)."
        exit 1
    fi
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

safe_rm_rf() {
    local target="$1"
    case "$target" in
        ""|"/"|"/etc"|"/usr"|"/var"|"/home"|"/root"|".")
            log_warn "Ignorando caminho inseguro para remocao: $target"
            return 0
            ;;
    esac
    rm -rf -- "$target" 2>/dev/null || true
}

safe_rm_file() {
    local target="$1"
    rm -f -- "$target" 2>/dev/null || true
}

trim_quotes() {
    local value="$1"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    printf '%s' "$value"
}

get_env_value() {
    local key="$1"
    local file="$2"
    local line=""
    [[ -f "$file" ]] || return 1
    line="$(grep -m1 -E "^${key}=" "$file" 2>/dev/null || true)"
    [[ -n "$line" ]] || return 1
    trim_quotes "${line#*=}"
}

extract_db_user_from_url() {
    local url="$1"
    echo "$url" | sed -nE 's#^postgres(ql)?://([^:/@]+)(:[^@]*)?@[^/]+/[^?]+.*#\2#p'
}

extract_db_name_from_url() {
    local url="$1"
    echo "$url" | sed -nE 's#^postgres(ql)?://[^/]+/([^?]+).*$#\2#p'
}

extract_domain_from_url() {
    local value="$1"
    echo "$value" | sed -nE 's#^[a-zA-Z]+://([^/:]+).*$#\1#p'
}

list_native_instances() {
    [[ -d "$NATIVE_BASE_DIR" ]] || return 0
    find "$NATIVE_BASE_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | while IFS= read -r instance_dir; do
        if [[ -f "$instance_dir/apps/backend/.env" ]] && [[ -d "$instance_dir/apps/frontend" ]]; then
            echo "$instance_dir"
        fi
    done
}

run_as_native_user() {
    local cmd="$1"
    if ! id "$NATIVE_SYSTEM_USER" >/dev/null 2>&1; then
        return 0
    fi

    if command_exists runuser; then
        runuser -u "$NATIVE_SYSTEM_USER" -- bash -lc "$cmd" >/dev/null 2>&1 || true
    elif command_exists sudo; then
        sudo -u "$NATIVE_SYSTEM_USER" bash -lc "$cmd" >/dev/null 2>&1 || true
    else
        su - "$NATIVE_SYSTEM_USER" -c "$cmd" >/dev/null 2>&1 || true
    fi
}

run_as_postgres() {
    if command_exists runuser; then
        runuser -u postgres -- "$@"
    elif command_exists sudo; then
        sudo -u postgres "$@"
    else
        su - postgres -c "$(printf '%q ' "$@")"
    fi
}

sql_escape_literal() {
    printf '%s' "$1" | sed "s/'/''/g"
}

sql_escape_ident() {
    printf '%s' "$1" | sed 's/"/""/g'
}

ensure_postgresql_running() {
    if command_exists systemctl && systemctl list-unit-files 2>/dev/null | grep -q '^postgresql'; then
        systemctl start postgresql >/dev/null 2>&1 || true
    fi
}

drop_postgres_db_and_user() {
    local db_name="$1"
    local db_user="$2"

    if [[ -z "$db_name" && -z "$db_user" ]]; then
        return 0
    fi

    if ! id postgres >/dev/null 2>&1; then
        log_warn "Usuario postgres nao encontrado; pulando drop de banco/usuario."
        return 0
    fi

    if ! command_exists psql; then
        log_warn "psql nao encontrado; pulando drop de banco/usuario."
        return 0
    fi

    ensure_postgresql_running

    if ! run_as_postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
        log_warn "PostgreSQL indisponivel; pulando drop de banco/usuario."
        return 0
    fi

    if [[ -n "$db_name" ]]; then
        local db_name_lit db_name_ident
        db_name_lit="$(sql_escape_literal "$db_name")"
        db_name_ident="$(sql_escape_ident "$db_name")"

        if run_as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name_lit}'" | grep -q 1; then
            log_info "Removendo banco: $db_name"
            run_as_postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${db_name_lit}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
            run_as_postgres psql -c "DROP DATABASE IF EXISTS \"${db_name_ident}\";" >/dev/null 2>&1 || true
        fi
    fi

    if [[ -n "$db_user" ]]; then
        local db_user_lit db_user_ident
        db_user_lit="$(sql_escape_literal "$db_user")"
        db_user_ident="$(sql_escape_ident "$db_user")"

        if run_as_postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${db_user_lit}'" | grep -q 1; then
            log_info "Removendo usuario do PostgreSQL: $db_user"
            run_as_postgres psql -c "DROP ROLE IF EXISTS \"${db_user_ident}\";" >/dev/null 2>&1 || true
        fi
    fi
}

compose_down_file() {
    local compose_file="$1"
    [[ -f "$compose_file" ]] || return 0

    if [[ -f "$ENV_FILE" ]]; then
        docker compose --env-file "$ENV_FILE" -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
    else
        docker compose -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
    fi
}

remove_docker_installation() {
    if ! command_exists docker; then
        log_warn "Docker nao encontrado; pulando remocao da stack Docker."
        return 0
    fi

    log_info "Parando e removendo stack Docker..."
    cd "$PROJECT_ROOT"
    compose_down_file "$PROJECT_ROOT/docker-compose.prod.yml"
    compose_down_file "$PROJECT_ROOT/docker-compose.prod.external.yml"
    compose_down_file "$PROJECT_ROOT/docker-compose.external-nginx.yml"

    local containers=(
        "multitenant-nginx"
        "multitenant-frontend"
        "multitenant-backend"
        "multitenant-postgres"
        "multitenant-redis"
    )
    docker rm -f "${containers[@]}" >/dev/null 2>&1 || true

    local project_slug project_slug_alt
    project_slug="$(basename "$PROJECT_ROOT" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9_-]+//g')"
    project_slug_alt="$(echo "$project_slug" | tr '-' '_')"
    local suffix
    for suffix in postgres_data redis_data uploads backups; do
        docker volume rm -f "${project_slug}_${suffix}" >/dev/null 2>&1 || true
        docker volume rm -f "${project_slug_alt}_${suffix}" >/dev/null 2>&1 || true
    done

    docker network rm multitenant-network >/dev/null 2>&1 || true
    while IFS= read -r net; do
        docker network rm "$net" >/dev/null 2>&1 || true
    done < <(docker network ls --format '{{.Name}}' 2>/dev/null | grep -E '_multitenant-network$' || true)

    local image_ids=()
    mapfile -t image_ids < <(docker images --format '{{.Repository}} {{.ID}}' 2>/dev/null | awk '/multitenant|Pluggor/{print $2}' | sort -u || true)
    if [[ "${#image_ids[@]}" -gt 0 ]]; then
        log_info "Removendo imagens locais da aplicacao..."
        docker rmi -f "${image_ids[@]}" >/dev/null 2>&1 || true
    fi
}

remove_native_instance() {
    local instance_dir="$1"
    local instance_name backend_env nginx_conf db_name db_user db_url domain
    instance_name="$(basename "$instance_dir")"
    backend_env="$instance_dir/apps/backend/.env"
    nginx_conf="/etc/nginx/sites-available/${instance_name}.conf"
    db_name=""
    db_user=""
    db_url=""
    domain=""

    log_info "Removendo instancia native: ${instance_name}"

    if [[ -f "$backend_env" ]]; then
        db_name="$(get_env_value "DB_NAME" "$backend_env" || true)"
        db_user="$(get_env_value "DB_USER" "$backend_env" || true)"
        db_url="$(get_env_value "DATABASE_URL" "$backend_env" || true)"

        if [[ -z "$db_user" && -n "$db_url" ]]; then
            db_user="$(extract_db_user_from_url "$db_url")"
        fi
        if [[ -z "$db_name" && -n "$db_url" ]]; then
            db_name="$(extract_db_name_from_url "$db_url")"
        fi

        local frontend_url
        frontend_url="$(get_env_value "FRONTEND_URL" "$backend_env" || true)"
        if [[ -n "$frontend_url" ]]; then
            domain="$(extract_domain_from_url "$frontend_url")"
        fi
    fi

    if [[ -z "$domain" && -f "$nginx_conf" ]]; then
        domain="$(grep -m1 -E '^[[:space:]]*server_name[[:space:]]+' "$nginx_conf" | sed -E 's/^[[:space:]]*server_name[[:space:]]+([^;[:space:]]+).*/\1/' || true)"
    fi

    run_as_native_user "pm2 delete '${instance_name}-backend' >/dev/null 2>&1 || true"
    run_as_native_user "pm2 delete '${instance_name}-frontend' >/dev/null 2>&1 || true"
    run_as_native_user "pm2 save >/dev/null 2>&1 || true"

    safe_rm_file "/etc/nginx/sites-enabled/${instance_name}.conf"
    safe_rm_file "/etc/nginx/sites-available/${instance_name}.conf"

    if [[ -n "$domain" ]] && command_exists certbot; then
        certbot delete --cert-name "$domain" --non-interactive >/dev/null 2>&1 || true
    fi

    drop_postgres_db_and_user "$db_name" "$db_user"
    safe_rm_rf "$instance_dir"
}

remove_native_installations() {
    local native_instances=()
    mapfile -t native_instances < <(list_native_instances)

    if [[ "${#native_instances[@]}" -eq 0 ]]; then
        log_warn "Nenhuma instalacao native detectada em $NATIVE_BASE_DIR."
        return 0
    fi

    local instance_dir
    for instance_dir in "${native_instances[@]}"; do
        remove_native_instance "$instance_dir"
    done

    if [[ -d "$NATIVE_BASE_DIR" ]] && [[ -z "$(find "$NATIVE_BASE_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null || true)" ]]; then
        safe_rm_rf "$NATIVE_BASE_DIR"
    fi

    if command_exists systemctl; then
        systemctl reload nginx >/dev/null 2>&1 || true
    fi
}

drop_postgres_from_env_file() {
    local db_name db_user db_url
    db_name=""
    db_user=""
    db_url=""

    [[ -f "$ENV_FILE" ]] || return 0

    db_name="$(get_env_value "DB_NAME" "$ENV_FILE" || true)"
    db_user="$(get_env_value "DB_USER" "$ENV_FILE" || true)"
    db_url="$(get_env_value "DATABASE_URL" "$ENV_FILE" || true)"

    if [[ -z "$db_user" && -n "$db_url" ]]; then
        db_user="$(extract_db_user_from_url "$db_url")"
    fi
    if [[ -z "$db_name" && -n "$db_url" ]]; then
        db_name="$(extract_db_name_from_url "$db_url")"
    fi

    drop_postgres_db_and_user "$db_name" "$db_user"
}

remove_project_generated_files() {
    log_info "Removendo artefatos gerados no repositorio..."
    safe_rm_file "$ENV_FILE"
    safe_rm_file "$PROJECT_ROOT/apps/backend/.env"
    safe_rm_file "$PROJECT_ROOT/apps/frontend/.env.local"
    safe_rm_rf "$PROJECT_ROOT/nginx"
    safe_rm_rf "$PROJECT_ROOT/uploads"
}

remove_native_user() {
    if id "$NATIVE_SYSTEM_USER" >/dev/null 2>&1; then
        log_info "Removendo usuario do sistema: $NATIVE_SYSTEM_USER"
        userdel -r "$NATIVE_SYSTEM_USER" >/dev/null 2>&1 || true
    fi
}

purge_system_dependencies() {
    if ! command_exists apt-get; then
        log_warn "apt-get nao encontrado; pulando purge de pacotes."
        return 0
    fi

    log_info "Parando servicos..."
    local services=(nginx docker postgresql redis-server ufw)
    local svc
    for svc in "${services[@]}"; do
        systemctl stop "$svc" >/dev/null 2>&1 || true
        systemctl disable "$svc" >/dev/null 2>&1 || true
    done

    log_info "Removendo pacotes instalados pelo instalador..."
    local docker_pkgs=(
        docker-ce
        docker-ce-cli
        containerd.io
        docker-buildx-plugin
        docker-compose-plugin
        docker-ce-rootless-extras
    )
    local native_pkgs=(
        nginx
        nginx-common
        nginx-full
        postgresql
        postgresql-contrib
        postgresql-common
        redis-server
        redis-tools
        nodejs
        certbot
        snapd
        ufw
        iptables-persistent
        netfilter-persistent
    )

    apt-get purge -y "${docker_pkgs[@]}" >/dev/null 2>&1 || true
    apt-get purge -y "${native_pkgs[@]}" >/dev/null 2>&1 || true

    if command_exists npm; then
        npm uninstall -g pm2 pnpm >/dev/null 2>&1 || true
    fi
    if command_exists snap; then
        snap remove certbot >/dev/null 2>&1 || true
    fi

    log_info "Removendo diretorios e dados de runtime..."
    safe_rm_rf "/var/lib/docker"
    safe_rm_rf "/var/lib/containerd"
    safe_rm_rf "/etc/docker"
    safe_rm_rf "/etc/nginx"
    safe_rm_rf "/etc/letsencrypt"
    safe_rm_rf "/var/www/certbot"
    safe_rm_rf "/var/lib/postgresql"
    safe_rm_rf "/etc/postgresql"
    safe_rm_rf "/var/log/postgresql"
    safe_rm_rf "/var/lib/redis"
    safe_rm_rf "/etc/ufw"
    safe_rm_rf "/etc/iptables"
    safe_rm_file "/etc/apt/sources.list.d/docker.list"
    safe_rm_file "/etc/apt/keyrings/docker.gpg"
    safe_rm_file "/usr/bin/certbot"

    apt-get autoremove -y >/dev/null 2>&1 || true
    apt-get autoclean -y >/dev/null 2>&1 || true
}

schedule_project_root_removal() {
    local target="$PROJECT_ROOT"
    case "$target" in
        ""|"/"|"/etc"|"/usr"|"/var"|"/home"|"/root"|".")
            log_warn "Caminho inseguro; diretorio do repositorio nao sera removido: $target"
            return 0
            ;;
    esac
    log_info "Agendando remocao do repositorio: $target"
    (sleep 1 && rm -rf -- "$target") &
}

show_menu() {
    local native_count=0
    native_count="$(list_native_instances | wc -l | tr -d '[:space:]')"
    local docker_state="nao detectado"
    if command_exists docker; then
        docker_state="instalado"
    fi

    echo -e "${BLUE}==========================================================${NC}"
    echo -e "${BLUE}      DESINSTALADOR DO PROJETO MULTITENANT                ${NC}"
    echo -e "${BLUE}==========================================================${NC}"
    echo ""
    echo -e "Estado detectado:"
    echo -e "  - Docker: ${docker_state}"
    echo -e "  - Instancias native: ${native_count}"
    echo ""
    echo -e "Escolha o tipo de desinstalacao:"
    echo -e "1) ${YELLOW}Remover aplicacao${NC} (Docker + Native + bancos da aplicacao + artefatos do projeto)"
    echo -e "2) ${RED}Limpeza total do servidor${NC} (opcao 1 + purge Docker/Nginx/PostgreSQL/Redis/Node/Certbot/UFW)"
    echo -e "q) Sair"
    echo ""
}

main() {
    require_root
    show_menu

    local opt confirm remove_repo
    read -rp "Opcao: " opt

    case "$opt" in
        1)
            echo -e "\n${YELLOW}AVISO: isso remove os dados da aplicacao e bancos detectados.${NC}"
            read -rp "Tem certeza? (s/N): " confirm
            [[ "$confirm" =~ ^[Ss]$ ]] || exit 0

            remove_docker_installation
            remove_native_installations
            drop_postgres_from_env_file
            remove_project_generated_files

            read -rp "Remover tambem o diretorio do repositorio ($PROJECT_ROOT)? (s/N): " remove_repo
            if [[ "$remove_repo" =~ ^[Ss]$ ]]; then
                schedule_project_root_removal
            fi
            ;;
        2)
            echo -e "\n${RED}AVISO CRITICO: ISSO REMOVE PACOTES E DADOS DO SISTEMA.${NC}"
            read -rp "Digite 'SIM' para confirmar: " confirm
            [[ "$confirm" == "SIM" ]] || exit 0

            remove_docker_installation
            remove_native_installations
            drop_postgres_from_env_file
            remove_project_generated_files
            remove_native_user
            purge_system_dependencies

            read -rp "Remover tambem o diretorio do repositorio ($PROJECT_ROOT)? (s/N): " remove_repo
            if [[ "$remove_repo" =~ ^[Ss]$ ]]; then
                schedule_project_root_removal
            fi
            ;;
        *)
            exit 0
            ;;
    esac

    log_success "Desinstalacao concluida."
    echo -e "\nSistema limpo para uma nova instalacao.\n"
}

main "$@"
