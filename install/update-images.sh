#!/usr/bin/env bash
# =============================================================================
# Atualizador Docker (Images)
# =============================================================================

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-install/.env.production}"
RELEASE_TAG="${RELEASE_TAG:-latest}"
UPDATE_CHANNEL="${UPDATE_CHANNEL:-release}"
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
  echo "[deploy] [$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

log_err() {
  echo "[deploy] [$(date -u +%Y-%m-%dT%H:%M:%SZ)] ERROR: $*" >&2
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/}"
  echo "$value"
}

write_build_metadata_files() {
  local version_value="$1"
  local sha_value="$2"
  local build_time_value="$3"
  local branch_value="$4"
  local version_json
  local sha_json
  local build_json
  local branch_json
  version_json="$(json_escape "$version_value")"
  sha_json="$(json_escape "$sha_value")"
  build_json="$(json_escape "$build_time_value")"
  branch_json="$(json_escape "$branch_value")"

  printf '%s\n' "${version_value:-unknown}" > "$PROJECT_ROOT/VERSION"
  if [[ -n "$branch_value" ]]; then
    printf '{\n  "version": "%s",\n  "commitSha": "%s",\n  "buildDate": "%s",\n  "branch": "%s"\n}\n' \
      "$version_json" "$sha_json" "$build_json" "$branch_json" > "$PROJECT_ROOT/BUILD_INFO.json"
  else
    printf '{\n  "version": "%s",\n  "commitSha": "%s",\n  "buildDate": "%s"\n}\n' \
      "$version_json" "$sha_json" "$build_json" > "$PROJECT_ROOT/BUILD_INFO.json"
  fi
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
export APP_VERSION="${APP_VERSION:-$RELEASE_TAG}"
export GIT_SHA="${GIT_SHA:-unknown}"
export BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

if [[ "$APP_VERSION" == "latest" ]]; then
  if [[ -d "$PROJECT_ROOT/.git" ]]; then
    exact_tag="$(git -C "$PROJECT_ROOT" describe --tags --exact-match 2>/dev/null || true)"
    short_sha="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || true)"
    if [[ -n "$exact_tag" ]]; then
      APP_VERSION="$exact_tag"
    elif [[ -n "$short_sha" ]]; then
      APP_VERSION="dev+${short_sha}"
    else
      APP_VERSION="unknown"
    fi
  else
    APP_VERSION="unknown"
  fi
fi

if [[ "$GIT_SHA" == "unknown" ]] && [[ -d "$PROJECT_ROOT/.git" ]]; then
  GIT_SHA="$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
fi
BUILD_BRANCH=""
if [[ -d "$PROJECT_ROOT/.git" ]]; then
  BUILD_BRANCH="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
write_build_metadata_files "$APP_VERSION" "$GIT_SHA" "$BUILD_TIME" "$BUILD_BRANCH"

log "Iniciando atualização Docker (Canal: $UPDATE_CHANNEL)"
log "versao alvo (RELEASE_TAG): $RELEASE_TAG"
log "metadata runtime: APP_VERSION=$APP_VERSION GIT_SHA=$GIT_SHA BUILD_TIME=$BUILD_TIME"
log "frontend anterior: cid=$PREV_FRONTEND_CONTAINER_ID image_id=$PREV_FRONTEND_IMAGE_ID image_name=$PREV_FRONTEND_IMAGE_NAME"
log "backend anterior:  cid=$PREV_BACKEND_CONTAINER_ID image_id=$PREV_BACKEND_IMAGE_ID image_name=$PREV_BACKEND_IMAGE_NAME"
log "frontend alvo compose image: $TARGET_FRONTEND_IMAGE"
log "backend alvo compose image:  $TARGET_BACKEND_IMAGE"

log "Efetuando pull das imagens..."
if ! compose pull frontend backend; then
  log_err "Falha ao baixar imagens do registro Docker."
  exit 1
fi

ROLLBACK_ENABLED=1

if compose config --services | grep -qx "migrate"; then
  log "executando migration job (service: migrate)"
  compose run --rm migrate
  MIGRATE_RAN=1
else
  log "service 'migrate' nao encontrado no compose (skip)"
fi

log "executando seed versionado (apenas pendentes)"
compose run --rm backend node dist/prisma/seed.js deploy

log "recriando containers frontend/backend"
compose up -d --no-deps --force-recreate frontend backend

log "aguardando healthchecks (timeout ${HEALTH_TIMEOUT}s)"
wait_for_service_healthy frontend "$HEALTH_TIMEOUT"
wait_for_service_healthy backend "$HEALTH_TIMEOUT"

log "deploy concluido com sucesso"
