#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_TEMPLATE_FILE="${SCRIPT_DIR}/nginx-proxy.compose.yml"
DEFAULT_PROXY_PROJECT_DIR="/opt/nginx-proxy"
DEFAULT_PROXY_NETWORK="nginx-proxy"

DOMAIN="${DOMAIN:-}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
APP_NAME="${APP_NAME:-}"
APP_INTERNAL_PORT="${APP_INTERNAL_PORT:-}"
APP_SERVICE="${APP_SERVICE:-}"
APP_PROJECT_DIR="${APP_PROJECT_DIR:-}"
APP_COMPOSE_FILES_RAW="${APP_COMPOSE_FILES:-}"
PROXY_PROJECT_DIR="${PROXY_PROJECT_DIR:-$DEFAULT_PROXY_PROJECT_DIR}"
PROXY_NETWORK="${PROXY_NETWORK:-$DEFAULT_PROXY_NETWORK}"

declare -a APP_COMPOSE_FILES=()
declare -a COMPOSE_ARGS=()
PROXY_CONTAINER=""
ACME_CONTAINER=""
PROXY_EXISTS="false"
PROXY_COMPOSE_FILE=""
APP_OVERRIDE_FILE=""
APP_CONTAINER_ID=""
PUBLIC_IP=""
CERTS_HOST_PATH=""

log_info() {
  echo -e "\033[1;34m[INFO]\033[0m $*"
}

log_warn() {
  echo -e "\033[1;33m[WARN]\033[0m $*"
}

log_error() {
  echo -e "\033[1;31m[ERROR]\033[0m $*" >&2
}

usage() {
  cat <<'EOF'
Uso:
  sudo bash install/setup.sh \
    --domain crm.exemplo.com.br \
    --email admin@exemplo.com.br \
    --app-name multitenant \
    --app-port 4000 \
    --app-compose /caminho/docker-compose.yml \
    [--app-compose /caminho/docker-compose.prod.yml] \
    [--app-service frontend] \
    [--proxy-project-dir /opt/nginx-proxy] \
    [--proxy-network nginx-proxy]

Entradas via variavel de ambiente tambem sao aceitas:
  DOMAIN, LETSENCRYPT_EMAIL, APP_NAME, APP_INTERNAL_PORT,
  APP_SERVICE, APP_COMPOSE_FILES (separado por virgula),
  APP_PROJECT_DIR, PROXY_PROJECT_DIR, PROXY_NETWORK
EOF
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    log_error "Execute como root (sudo)."
    exit 1
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Comando obrigatorio nao encontrado: $1"
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain)
        DOMAIN="$2"
        shift 2
        ;;
      --email)
        LETSENCRYPT_EMAIL="$2"
        shift 2
        ;;
      --app-name)
        APP_NAME="$2"
        shift 2
        ;;
      --app-port)
        APP_INTERNAL_PORT="$2"
        shift 2
        ;;
      --app-service)
        APP_SERVICE="$2"
        shift 2
        ;;
      --app-compose)
        APP_COMPOSE_FILES+=("$2")
        shift 2
        ;;
      --app-project-dir)
        APP_PROJECT_DIR="$2"
        shift 2
        ;;
      --proxy-project-dir)
        PROXY_PROJECT_DIR="$2"
        shift 2
        ;;
      --proxy-network)
        PROXY_NETWORK="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        log_error "Parametro invalido: $1"
        usage
        exit 1
        ;;
    esac
  done
}

normalize_inputs() {
  if [[ -n "$APP_COMPOSE_FILES_RAW" && "${#APP_COMPOSE_FILES[@]}" -eq 0 ]]; then
    IFS=',' read -r -a APP_COMPOSE_FILES <<< "$APP_COMPOSE_FILES_RAW"
    IFS=$'\n\t'
  fi

  if [[ -z "$APP_SERVICE" && -n "$APP_NAME" ]]; then
    APP_SERVICE="$APP_NAME"
  fi

  if [[ -z "$DOMAIN" || -z "$LETSENCRYPT_EMAIL" || -z "$APP_NAME" || -z "$APP_INTERNAL_PORT" || -z "$APP_SERVICE" ]]; then
    log_error "DOMAIN, LETSENCRYPT_EMAIL, APP_NAME, APP_INTERNAL_PORT e APP_SERVICE sao obrigatorios."
    usage
    exit 1
  fi

  if [[ "${#APP_COMPOSE_FILES[@]}" -eq 0 ]]; then
    log_error "Informe ao menos um --app-compose."
    usage
    exit 1
  fi

  local idx=0
  local compose_file
  for compose_file in "${APP_COMPOSE_FILES[@]}"; do
    if [[ ! -f "$compose_file" ]]; then
      log_error "Arquivo compose nao encontrado: $compose_file"
      exit 1
    fi
    APP_COMPOSE_FILES[$idx]="$(cd "$(dirname "$compose_file")" && pwd)/$(basename "$compose_file")"
    idx=$((idx + 1))
  done

  if [[ -z "$APP_PROJECT_DIR" ]]; then
    APP_PROJECT_DIR="$(dirname "${APP_COMPOSE_FILES[0]}")"
  fi
  APP_PROJECT_DIR="$(cd "$APP_PROJECT_DIR" && pwd)"

  if [[ ! "$APP_INTERNAL_PORT" =~ ^[0-9]+$ ]]; then
    log_error "APP_INTERNAL_PORT invalida: $APP_INTERNAL_PORT"
    exit 1
  fi
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log_info "Docker nao encontrado. Instalando..."
    require_cmd curl
    curl -fsSL https://get.docker.com | sh
  fi

  if ! docker compose version >/dev/null 2>&1; then
    log_error "Docker Compose plugin nao encontrado. Instale docker-compose-plugin."
    exit 1
  fi
}

ensure_dnsutils() {
  if ! command -v dig >/dev/null 2>&1; then
    log_info "Instalando dnsutils (dig)..."
    apt-get update -y
    apt-get install -y dnsutils
  fi
}

validate_dns_points_to_server() {
  PUBLIC_IP="$(curl -4 -fsSL ifconfig.me || true)"
  if [[ -z "$PUBLIC_IP" ]]; then
    log_error "Nao foi possivel obter o IP publico via ifconfig.me."
    exit 1
  fi

  mapfile -t domain_ips < <(dig +short A "$DOMAIN" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)
  if [[ "${#domain_ips[@]}" -eq 0 ]]; then
    log_error "O dominio $DOMAIN nao possui registro A."
    log_error "Aponte o DNS para $PUBLIC_IP e execute novamente."
    exit 1
  fi

  local matches_public="false"
  local ip
  for ip in "${domain_ips[@]}"; do
    if [[ "$ip" == "$PUBLIC_IP" ]]; then
      matches_public="true"
      break
    fi
  done

  if [[ "$matches_public" != "true" ]]; then
    log_error "DNS inconsistente: $DOMAIN resolve para [${domain_ips[*]}], mas o IP publico desta VPS e $PUBLIC_IP."
    log_error "Corrija o DNS e execute novamente."
    exit 1
  fi

  log_info "IP publico detectado: $PUBLIC_IP"
  log_info "DNS validado para $DOMAIN."
}

detect_proxy_stack() {
  local docker_ps
  docker_ps="$(docker ps --format '{{.Names}} {{.Image}}')"

  local line
  while IFS= read -r line; do
    local name image
    name="$(awk '{print $1}' <<< "$line")"
    image="$(awk '{print $2}' <<< "$line")"

    if [[ -z "$PROXY_CONTAINER" ]]; then
      if [[ "$name" == *nginx-proxy* ]] || [[ "$image" == nginxproxy/nginx-proxy* ]] || [[ "$image" == jwilder/nginx-proxy* ]]; then
        PROXY_CONTAINER="$name"
      fi
    fi

    if [[ -z "$ACME_CONTAINER" ]]; then
      if [[ "$name" == *acme-companion* ]] || [[ "$image" == nginxproxy/acme-companion* ]] || [[ "$image" == *letsencrypt-nginx-proxy-companion* ]]; then
        ACME_CONTAINER="$name"
      fi
    fi
  done <<< "$docker_ps"

  if [[ -n "$PROXY_CONTAINER" && -n "$ACME_CONTAINER" ]]; then
    PROXY_EXISTS="true"
    log_info "Stack existente encontrado: proxy=$PROXY_CONTAINER companion=$ACME_CONTAINER"
  elif [[ -n "$PROXY_CONTAINER" || -n "$ACME_CONTAINER" ]]; then
    log_error "Encontrado stack parcial (proxy ou companion sem par). Ajuste manualmente antes de prosseguir."
    exit 1
  else
    PROXY_EXISTS="false"
    log_info "Nenhum stack nginx-proxy/acme-companion existente encontrado."
  fi
}

find_proxy_network() {
  local networks
  mapfile -t networks < <(docker inspect -f '{{range $k, $_ := .NetworkSettings.Networks}}{{printf "%s\n" $k}}{{end}}' "$PROXY_CONTAINER")

  if [[ "${#networks[@]}" -eq 0 ]]; then
    log_error "Nao foi possivel detectar network do proxy."
    exit 1
  fi

  local selected="${networks[0]}"
  local net
  for net in "${networks[@]}"; do
    if [[ "$net" == *nginx-proxy* ]]; then
      selected="$net"
      break
    fi
  done
  PROXY_NETWORK="$selected"
}

validate_proxy_ports_exposed() {
  local bindings
  bindings="$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$PROXY_CONTAINER")"
  if [[ "$bindings" != *"80/tcp"* || "$bindings" != *"443/tcp"* ]]; then
    log_error "Proxy existente nao expoe 80/443 no host. Bindings atuais: $bindings"
    exit 1
  fi
}

validate_ports_no_conflict() {
  local port_lines docker_port_owners
  port_lines="$(ss -tulnp | egrep ':(80|443)\s' || true)"
  docker_port_owners="$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E '(:80->|:443->|\]:80->|\]:443->)' || true)"

  if [[ "$PROXY_EXISTS" == "true" ]]; then
    if [[ -n "$docker_port_owners" ]]; then
      local row
      while IFS= read -r row; do
        local name
        name="$(awk '{print $1}' <<< "$row")"
        if [[ "$name" != "$PROXY_CONTAINER" ]]; then
          log_error "Conflito: container $name tambem usa porta 80/443."
          log_error "Saida: $row"
          exit 1
        fi
      done <<< "$docker_port_owners"
    fi
    return 0
  fi

  if [[ -n "$docker_port_owners" ]]; then
    log_error "Porta 80/443 ocupada por container Docker sem stack proxy detectado:"
    echo "$docker_port_owners"
    exit 1
  fi

  if [[ -n "$port_lines" ]]; then
    log_error "Porta 80/443 ocupada por processo nao-Docker:"
    echo "$port_lines"
    log_error "Pare o processo (ex.: nginx/apache no host) e execute novamente."
    exit 1
  fi
}

create_proxy_stack_if_needed() {
  if [[ "$PROXY_EXISTS" == "true" ]]; then
    find_proxy_network
    validate_proxy_ports_exposed
    return 0
  fi

  if [[ ! -f "$PROXY_TEMPLATE_FILE" ]]; then
    log_error "Template de proxy nao encontrado: $PROXY_TEMPLATE_FILE"
    exit 1
  fi

  mkdir -p "$PROXY_PROJECT_DIR"/{certs,vhost.d,html,conf.d}
  PROXY_COMPOSE_FILE="${PROXY_PROJECT_DIR}/docker-compose.yml"
  cp -f "$PROXY_TEMPLATE_FILE" "$PROXY_COMPOSE_FILE"

  cat > "${PROXY_PROJECT_DIR}/.env" <<EOF
DEFAULT_EMAIL=${LETSENCRYPT_EMAIL}
PROXY_NETWORK=${PROXY_NETWORK}
EOF

  log_info "Subindo stack nginx-proxy + acme-companion em $PROXY_PROJECT_DIR..."
  docker compose --project-name nginx-proxy -f "$PROXY_COMPOSE_FILE" --env-file "${PROXY_PROJECT_DIR}/.env" up -d

  PROXY_CONTAINER="nginx-proxy"
  ACME_CONTAINER="acme-companion"
  PROXY_EXISTS="true"
}

build_compose_args() {
  COMPOSE_ARGS=()
  local compose_file
  for compose_file in "${APP_COMPOSE_FILES[@]}"; do
    COMPOSE_ARGS+=(-f "$compose_file")
  done
}

generate_app_override() {
  APP_OVERRIDE_FILE="${APP_PROJECT_DIR}/docker-compose.proxy.override.yml"
  cat > "$APP_OVERRIDE_FILE" <<EOF
services:
  ${APP_SERVICE}:
    environment:
      VIRTUAL_HOST: "${DOMAIN}"
      LETSENCRYPT_HOST: "${DOMAIN}"
      LETSENCRYPT_EMAIL: "${LETSENCRYPT_EMAIL}"
      VIRTUAL_PORT: "${APP_INTERNAL_PORT}"
networks:
  proxy:
    external: true
    name: "${PROXY_NETWORK}"
EOF
}

deploy_app() {
  build_compose_args
  generate_app_override

  log_info "Subindo aplicacao (servico: $APP_SERVICE)..."
  (
    cd "$APP_PROJECT_DIR"
    docker compose "${COMPOSE_ARGS[@]}" -f "$APP_OVERRIDE_FILE" up -d --build "$APP_SERVICE"
    APP_CONTAINER_ID="$(docker compose "${COMPOSE_ARGS[@]}" -f "$APP_OVERRIDE_FILE" ps -q "$APP_SERVICE" | head -n 1)"
    if [[ -z "$APP_CONTAINER_ID" ]]; then
      log_error "Nao foi possivel localizar o container do servico $APP_SERVICE."
      exit 1
    fi

    local proxy_attached
    proxy_attached="$(docker inspect -f '{{range $k, $_ := .NetworkSettings.Networks}}{{printf "%s\n" $k}}{{end}}' "$APP_CONTAINER_ID" | grep -Fx "$PROXY_NETWORK" || true)"
    if [[ -z "$proxy_attached" ]]; then
      log_info "Conectando container da app a network $PROXY_NETWORK..."
      docker network connect "$PROXY_NETWORK" "$APP_CONTAINER_ID"
    else
      log_info "Container da app ja conectado a network $PROXY_NETWORK."
    fi
  )
}

validate_runtime() {
  local http_headers=""
  local https_headers=""

  log_info "Logs recentes do proxy:"
  docker logs "$PROXY_CONTAINER" --tail 200 || true
  log_info "Logs recentes do acme-companion:"
  docker logs "$ACME_CONTAINER" --tail 200 || true

  log_info "Teste HTTP: http://$DOMAIN"
  http_headers="$(curl -sSI --max-time 20 "http://$DOMAIN" || true)"
  if [[ -z "$http_headers" ]]; then
    log_warn "Sem resposta HTTP imediata de $DOMAIN."
  else
    echo "$http_headers" | head -n 5
  fi

  log_info "Aguardando emissao HTTPS (tentativas de 10s, max 12)..."
  local attempt
  for attempt in $(seq 1 12); do
    https_headers="$(curl -sSI --max-time 20 "https://$DOMAIN" || true)"
    if [[ -n "$https_headers" ]]; then
      break
    fi
    sleep 10
  done

  if [[ -z "$https_headers" ]]; then
    log_warn "HTTPS ainda indisponivel. Verifique logs do acme-companion."
  else
    echo "$https_headers" | head -n 5
  fi
}

print_report() {
  CERTS_HOST_PATH="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/nginx/certs"}}{{.Source}}{{end}}{{end}}' "$PROXY_CONTAINER" || true)"

  echo ""
  echo "===== RELATORIO FINAL ====="
  echo "App name: ${APP_NAME}"
  echo "Service roteado: ${APP_SERVICE}"
  echo "Dominio: ${DOMAIN}"
  echo "Porta interna (VIRTUAL_PORT): ${APP_INTERNAL_PORT}"
  echo "Network do proxy: ${PROXY_NETWORK}"
  echo "Proxy project dir: ${PROXY_PROJECT_DIR}"
  echo "Proxy container: ${PROXY_CONTAINER}"
  echo "ACME container: ${ACME_CONTAINER}"
  echo "Certificados em: ${CERTS_HOST_PATH:-nao detectado}"
  echo "URL teste HTTP:  http://${DOMAIN}"
  echo "URL teste HTTPS: https://${DOMAIN}"
  echo ""
  echo "Containers relevantes:"
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep -E "NAMES|${PROXY_CONTAINER}|${ACME_CONTAINER}|${APP_NAME}|${APP_SERVICE}" || true
  echo "==========================="
}

main() {
  parse_args "$@"
  require_root
  require_cmd ss
  require_cmd awk
  require_cmd grep
  require_cmd curl
  ensure_docker
  ensure_dnsutils
  normalize_inputs
  validate_dns_points_to_server
  detect_proxy_stack
  validate_ports_no_conflict
  create_proxy_stack_if_needed
  deploy_app
  validate_runtime
  print_report
}

main "$@"
