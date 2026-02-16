#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-install/.env.production}"
RELEASE_TAG="${RELEASE_TAG:-latest}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
ROLLBACK_HEALTH_TIMEOUT="${ROLLBACK_HEALTH_TIMEOUT:-120}"

PREV_FRONTEND_CONTAINER_ID=""
PREV_BACKEND_CONTAINER_ID=""
PREV_FRONTEND_IMAGE_ID=""
PREV_BACKEND_IMAGE_ID=""
PREV_FRONTEND_IMAGE_NAME=""
PREV_BACKEND_IMAGE_NAME=""
TARGET_FRONTEND_IMAGE=""
TARGET_BACKEND_IMAGE=""
ROLLBACK_ENABLED=0
ROLLBACK_ATTEMPTED=0
ROLLBACK_COMPLETED_FLAG=0
MIGRATE_RAN=0

log() {
  echo "[deploy] $*"
}

log_err() {
  echo "[deploy] ERROR: $*" >&2
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

get_container_id() {
  local service="$1"
  compose ps -q "$service" | head -n 1
}

get_container_image_id() {
  local service="$1"
  local container_id
  container_id="$(get_container_id "$service")"
  if [ -z "$container_id" ]; then
    return 1
  fi
  docker inspect --format '{{.Image}}' "$container_id"
}

get_container_image_name() {
  local service="$1"
  local container_id
  container_id="$(get_container_id "$service")"
  if [ -z "$container_id" ]; then
    return 1
  fi
  docker inspect --format '{{.Config.Image}}' "$container_id"
}

get_target_image_from_compose() {
  local service="$1"
  local image

  image="$({
    compose config | awk -v svc="$service" '
      $0 ~ "^  " svc ":" { in_block=1; next }
      in_block && $0 ~ "^  [A-Za-z0-9_-]+:" { exit }
      in_block && $1 == "image:" { print $2; exit }
    '
  } || true)"

  image="${image%\"}"
  image="${image#\"}"
  if [ -z "$image" ]; then
    return 1
  fi
  echo "$image"
}

wait_for_service_healthy() {
  local service="$1"
  local timeout="$2"
  local start_ts now_ts elapsed container_id health_status

  start_ts="$(date +%s)"
  while true; do
    container_id="$(get_container_id "$service")"
    if [ -z "$container_id" ]; then
      log_err "container do servico '$service' nao encontrado"
      return 1
    fi

    health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_id" 2>/dev/null || echo 'inspect-error')"
    case "$health_status" in
      healthy)
        log "servico '$service' esta HEALTHY"
        return 0
        ;;
      starting)
        log "servico '$service' em warming up (starting)"
        ;;
      unhealthy)
        log_err "servico '$service' em estado invalido: $health_status"
        return 1
        ;;
      no-healthcheck)
        log_err "servico '$service' sem healthcheck. Adicione healthcheck no compose para este servico."
        return 1
        ;;
      inspect-error)
        log_err "falha ao inspecionar health do servico '$service'"
        return 1
        ;;
      *)
        log "servico '$service' aguardando health: $health_status"
        ;;
    esac

    now_ts="$(date +%s)"
    elapsed=$((now_ts - start_ts))
    if [ "$elapsed" -ge "$timeout" ]; then
      log_err "timeout aguardando health do servico '$service' (${timeout}s)"
      return 1
    fi

    sleep 5
  done
}

perform_rollback() {
  if [ -z "$PREV_FRONTEND_IMAGE_ID" ] || [ -z "$PREV_BACKEND_IMAGE_ID" ]; then
    log_err "rollback indisponivel: IMAGE ID anterior nao capturado"
    return 1
  fi
  if [ -z "$TARGET_FRONTEND_IMAGE" ] || [ -z "$TARGET_BACKEND_IMAGE" ]; then
    log_err "rollback indisponivel: imagem alvo frontend/backend nao resolvida pelo compose"
    return 1
  fi

  log "iniciando rollback automatico"
  log "rollback frontend target: $TARGET_FRONTEND_IMAGE <- $PREV_FRONTEND_IMAGE_ID ($PREV_FRONTEND_IMAGE_NAME)"
  log "rollback backend target:  $TARGET_BACKEND_IMAGE <- $PREV_BACKEND_IMAGE_ID ($PREV_BACKEND_IMAGE_NAME)"
  if [ "$MIGRATE_RAN" -eq 1 ]; then
    log_err "rollback foi apenas dos containers de app; o schema/dados do banco pode ter avancado."
  fi

  docker image inspect "$PREV_FRONTEND_IMAGE_ID" >/dev/null
  docker image inspect "$PREV_BACKEND_IMAGE_ID" >/dev/null

  docker image tag "$PREV_FRONTEND_IMAGE_ID" "$TARGET_FRONTEND_IMAGE"
  docker image tag "$PREV_BACKEND_IMAGE_ID" "$TARGET_BACKEND_IMAGE"

  compose up -d --no-deps --force-recreate frontend backend
  wait_for_service_healthy frontend "$ROLLBACK_HEALTH_TIMEOUT"
  wait_for_service_healthy backend "$ROLLBACK_HEALTH_TIMEOUT"

  ROLLBACK_COMPLETED_FLAG=1
  log "ROLLBACK_COMPLETED: rollback automatico concluido"
}

on_error() {
  local line="$1"
  local exit_code="${2:-1}"

  log_err "falha no deploy (linha $line, exit $exit_code)"
  if [ "$ROLLBACK_ENABLED" -eq 1 ] && [ "$ROLLBACK_ATTEMPTED" -eq 0 ]; then
    ROLLBACK_ATTEMPTED=1
    if perform_rollback; then
      log_err "rollback automatico aplicado apos falha"
    else
      log_err "rollback automatico falhou"
    fi
  fi

  if [ "$ROLLBACK_COMPLETED_FLAG" -eq 1 ]; then
    exit 2
  fi
  exit "$exit_code"
}

trap 'on_error $LINENO $?' ERR

if ! docker compose version >/dev/null 2>&1; then
  log_err "docker compose v2 nao disponivel"
  exit 1
fi

case "$COMPOSE_FILE" in
  docker-compose.prod.yml|docker-compose.prod.external.yml) ;;
  *)
    log_err "compose file nao permitido: $COMPOSE_FILE"
    exit 1
    ;;
esac

case "$ENV_FILE" in
  install/.env.production|.env.production|.env) ;;
  *)
    log_err "env file nao permitido: $ENV_FILE"
    exit 1
    ;;
esac

cd "$PROJECT_ROOT"

if [ ! -f "$COMPOSE_FILE" ]; then
  log_err "arquivo compose nao encontrado: $COMPOSE_FILE"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  log_err "arquivo env nao encontrado: $ENV_FILE"
  exit 1
fi

PREV_FRONTEND_CONTAINER_ID="$(get_container_id frontend || true)"
PREV_BACKEND_CONTAINER_ID="$(get_container_id backend || true)"
PREV_FRONTEND_IMAGE_ID="$(get_container_image_id frontend || true)"
PREV_BACKEND_IMAGE_ID="$(get_container_image_id backend || true)"
PREV_FRONTEND_IMAGE_NAME="$(get_container_image_name frontend || true)"
PREV_BACKEND_IMAGE_NAME="$(get_container_image_name backend || true)"
TARGET_FRONTEND_IMAGE="$(get_target_image_from_compose frontend || true)"
TARGET_BACKEND_IMAGE="$(get_target_image_from_compose backend || true)"

if [ -z "$PREV_FRONTEND_CONTAINER_ID" ] || [ -z "$PREV_BACKEND_CONTAINER_ID" ]; then
  log_err "nao foi possivel capturar container atual de frontend/backend"
  exit 1
fi
if [ -z "$PREV_FRONTEND_IMAGE_ID" ] || [ -z "$PREV_BACKEND_IMAGE_ID" ]; then
  log_err "nao foi possivel capturar IMAGE ID anterior de frontend/backend"
  exit 1
fi
if [ -z "$TARGET_FRONTEND_IMAGE" ] || [ -z "$TARGET_BACKEND_IMAGE" ]; then
  log_err "nao foi possivel resolver imagem alvo de frontend/backend via compose config"
  exit 1
fi

export RELEASE_TAG

log "versao alvo (RELEASE_TAG): $RELEASE_TAG"
log "frontend anterior: cid=$PREV_FRONTEND_CONTAINER_ID image_id=$PREV_FRONTEND_IMAGE_ID image_name=$PREV_FRONTEND_IMAGE_NAME"
log "backend anterior:  cid=$PREV_BACKEND_CONTAINER_ID image_id=$PREV_BACKEND_IMAGE_ID image_name=$PREV_BACKEND_IMAGE_NAME"
log "frontend alvo compose image: $TARGET_FRONTEND_IMAGE"
log "backend alvo compose image:  $TARGET_BACKEND_IMAGE"
log "pull de imagens"
compose pull frontend backend

ROLLBACK_ENABLED=1

if compose config --services | grep -qx "migrate"; then
  log "executando migration job (service: migrate)"
  compose run --rm migrate
  MIGRATE_RAN=1
else
  log "service 'migrate' nao encontrado no compose (skip)"
fi

log "recriando containers frontend/backend"
compose up -d --no-deps --force-recreate frontend backend

log "aguardando healthchecks (timeout ${HEALTH_TIMEOUT}s)"
wait_for_service_healthy frontend "$HEALTH_TIMEOUT"
wait_for_service_healthy backend "$HEALTH_TIMEOUT"

log "deploy concluido com sucesso"
