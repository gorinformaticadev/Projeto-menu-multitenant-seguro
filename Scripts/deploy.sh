#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_ROOT="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="$RELEASE_ROOT/.deploy-runtime"
VALIDATION_DIR="$RUNTIME_DIR/validation"
BACKEND_PID_FILE="$VALIDATION_DIR/backend.pid"
FRONTEND_PID_FILE="$VALIDATION_DIR/frontend.pid"
BACKEND_LOG_FILE="$VALIDATION_DIR/backend.log"
FRONTEND_LOG_FILE="$VALIDATION_DIR/frontend.log"
DEFAULT_VALIDATION_HOST="${VALIDATION_HOST:-127.0.0.1}"
DEFAULT_VALIDATION_BACKEND_PORT="${VALIDATION_BACKEND_PORT:-4100}"
DEFAULT_VALIDATION_FRONTEND_PORT="${VALIDATION_FRONTEND_PORT:-5100}"

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy][ERROR] %s\n' "$*" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || fail "Comando obrigatorio ausente: $command_name"
}

read_env_value() {
  local file_path="$1"
  local key="$2"
  local default_value="${3:-}"
  local value=""

  if [[ -f "$file_path" ]]; then
    value="$(grep -E "^${key}=" "$file_path" | tail -n 1 | cut -d= -f2- || true)"
  fi

  if [[ -z "$value" ]]; then
    value="$default_value"
  fi

  printf '%s\n' "$value"
}

json_escape() {
  local value="${1:-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

resolve_source_repo_dir() {
  if [[ -n "${APP_SOURCE_DIR:-}" ]] && git -C "$APP_SOURCE_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    printf '%s\n' "$APP_SOURCE_DIR"
    return 0
  fi

  if git -C "$RELEASE_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    printf '%s\n' "$RELEASE_ROOT"
    return 0
  fi

  return 1
}

resolve_release_version_value() {
  local source_repo_dir="$1"
  local exact_tag=""
  local short_sha=""

  exact_tag="$(git -C "$source_repo_dir" describe --tags --exact-match 2>/dev/null || true)"
  if [[ -n "$exact_tag" ]]; then
    printf '%s\n' "$exact_tag"
    return 0
  fi

  short_sha="$(git -C "$source_repo_dir" rev-parse --short HEAD 2>/dev/null || true)"
  if [[ -n "$short_sha" ]]; then
    printf 'dev+%s\n' "$short_sha"
    return 0
  fi

  return 1
}

write_release_metadata() {
  local source_repo_dir=""
  local version_value=""
  local commit_sha=""
  local branch_name=""
  local build_date=""
  local version_json=""
  local sha_json=""
  local branch_json=""

  source_repo_dir="$(resolve_source_repo_dir)" || fail "Nao foi possivel localizar um repositorio Git valido para gerar a metadata da release"
  version_value="$(resolve_release_version_value "$source_repo_dir")" || fail "Nao foi possivel resolver a versao da release a partir de $source_repo_dir"
  commit_sha="$(git -C "$source_repo_dir" rev-parse HEAD 2>/dev/null || true)"
  branch_name="$(git -C "$source_repo_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  build_date="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  version_json="$(json_escape "$version_value")"
  sha_json="$(json_escape "${commit_sha:-unknown}")"
  branch_json="$(json_escape "${branch_name:-unknown}")"

  printf '%s\n' "$version_value" > "$RELEASE_ROOT/VERSION"
  printf '{\n  "version": "%s",\n  "commitSha": "%s",\n  "buildDate": "%s",\n  "branch": "%s"\n}\n' \
    "$version_json" "$sha_json" "$build_date" "$branch_json" > "$RELEASE_ROOT/BUILD_INFO.json"

  log "Metadata da release atualizada: version=$version_value commit=${commit_sha:-unknown}"
}

resolve_backend_port() {
  read_env_value "$RELEASE_ROOT/apps/backend/.env" "PORT" "${PUBLISHED_BACKEND_PORT:-4000}"
}

resolve_frontend_port() {
  if [[ -n "${PUBLISHED_FRONTEND_PORT:-}" ]]; then
    printf '%s\n' "$PUBLISHED_FRONTEND_PORT"
    return 0
  fi
  printf '%s\n' "5000"
}

copy_directory_contents() {
  local source_dir="$1"
  local destination_dir="$2"

  mkdir -p "$destination_dir"
  cp -a "$source_dir"/. "$destination_dir"/
}

resolve_frontend_standalone_layout() {
  local frontend_dir="$RELEASE_ROOT/apps/frontend"
  local resolved_layout=""

  if [[ -f "$frontend_dir/scripts/start-standalone.mjs" ]]; then
    resolved_layout="$(cd "$frontend_dir" && node scripts/start-standalone.mjs --print-layout)" || fail "Nao foi possivel resolver o layout standalone do frontend"
    IFS='|' read -r FRONTEND_STANDALONE_LAYOUT FRONTEND_STANDALONE_ENTRY_REL FRONTEND_STANDALONE_RUNTIME_DIR FRONTEND_STANDALONE_BUILD_DIR <<< "$resolved_layout"
  elif [[ -f "$frontend_dir/.next/standalone/apps/frontend/server.js" ]]; then
    FRONTEND_STANDALONE_LAYOUT="monorepo-nested"
    FRONTEND_STANDALONE_ENTRY_REL=".next/standalone/apps/frontend/server.js"
    FRONTEND_STANDALONE_RUNTIME_DIR=".next/standalone/apps/frontend"
    FRONTEND_STANDALONE_BUILD_DIR=".next/standalone/apps/frontend/.next"
  elif [[ -f "$frontend_dir/.next/standalone/server.js" ]]; then
    FRONTEND_STANDALONE_LAYOUT="root"
    FRONTEND_STANDALONE_ENTRY_REL=".next/standalone/server.js"
    FRONTEND_STANDALONE_RUNTIME_DIR=".next/standalone"
    FRONTEND_STANDALONE_BUILD_DIR=".next/standalone/.next"
  else
    fail "Nenhum entrypoint standalone do frontend foi encontrado apos o build"
  fi

  [[ -n "${FRONTEND_STANDALONE_ENTRY_REL:-}" ]] || fail "Resolver do standalone retornou entrypoint vazio"
  [[ -n "${FRONTEND_STANDALONE_RUNTIME_DIR:-}" ]] || fail "Resolver do standalone retornou runtime dir vazio"
  [[ -n "${FRONTEND_STANDALONE_BUILD_DIR:-}" ]] || fail "Resolver do standalone retornou build dir vazio"
}

package_frontend_runtime_assets() {
  local frontend_dir="$RELEASE_ROOT/apps/frontend"
  local build_dir="$frontend_dir/.next"
  local runtime_dir=""

  resolve_frontend_standalone_layout
  runtime_dir="$frontend_dir/$FRONTEND_STANDALONE_RUNTIME_DIR"

  if [[ -d "$frontend_dir/public" ]]; then
    copy_directory_contents "$frontend_dir/public" "$runtime_dir/public"
  fi

  if [[ -d "$build_dir/static" ]]; then
    copy_directory_contents "$build_dir/static" "$runtime_dir/.next/static"
  fi
}

count_frontend_manifest_files() {
  local base_dir="$1"
  if [[ ! -d "$base_dir" ]]; then
    printf '0\n'
    return 0
  fi

  find "$base_dir" -type f \( -name '*client-reference-manifest*' -o -name '*server-reference-manifest*' \) | wc -l | tr -d ' '
}

validate_frontend_artifact_layout() {
  local frontend_dir="$RELEASE_ROOT/apps/frontend"
  local build_dir="$frontend_dir/.next"
  local runtime_dir=""
  local standalone_build_dir=""
  local source_build_id=""
  local standalone_build_id=""
  local source_manifest_count="0"
  local standalone_manifest_count="0"

  resolve_frontend_standalone_layout
  runtime_dir="$frontend_dir/$FRONTEND_STANDALONE_RUNTIME_DIR"
  standalone_build_dir="$frontend_dir/$FRONTEND_STANDALONE_BUILD_DIR"

  [[ -f "$frontend_dir/$FRONTEND_STANDALONE_ENTRY_REL" ]] || fail "server.js do standalone nao encontrado em $frontend_dir/$FRONTEND_STANDALONE_ENTRY_REL"
  [[ -f "$build_dir/BUILD_ID" ]] || fail "BUILD_ID do frontend nao encontrado em $build_dir/BUILD_ID"
  [[ -f "$standalone_build_dir/BUILD_ID" ]] || fail "BUILD_ID do standalone nao encontrado em $standalone_build_dir/BUILD_ID"

  source_build_id="$(tr -d '\r' < "$build_dir/BUILD_ID" || true)"
  standalone_build_id="$(tr -d '\r' < "$standalone_build_dir/BUILD_ID" || true)"
  [[ -n "$source_build_id" ]] || fail "BUILD_ID do frontend veio vazio"
  [[ "$source_build_id" == "$standalone_build_id" ]] || fail "BUILD_ID inconsistente entre build e standalone (fonte=$source_build_id standalone=${standalone_build_id:-<vazio>})"

  if [[ -d "$build_dir/static" ]] && [[ ! -d "$runtime_dir/.next/static" ]]; then
    fail "Diretorio .next/static nao foi copiado para o standalone"
  fi

  if [[ -d "$frontend_dir/public" ]] && [[ ! -d "$runtime_dir/public" ]]; then
    fail "Diretorio public nao foi copiado para o standalone"
  fi

  source_manifest_count="$(count_frontend_manifest_files "$build_dir/server")"
  standalone_manifest_count="$(count_frontend_manifest_files "$standalone_build_dir/server")"
  if (( source_manifest_count > 0 && standalone_manifest_count == 0 )); then
    fail "Standalone nao contem manifests de referencia obrigatorios do frontend"
  fi
}

extract_first_static_asset_path() {
  local html_file="$1"

  [[ -f "$html_file" ]] || return 0
  grep -oE '/_next/static/[^"'"'"'[:space:]]+' "$html_file" | head -n 1 || true
}

ensure_release_layout() {
  [[ -d "$RELEASE_ROOT/apps/backend" ]] || fail "apps/backend nao encontrado em $RELEASE_ROOT"
  [[ -d "$RELEASE_ROOT/apps/frontend" ]] || fail "apps/frontend nao encontrado em $RELEASE_ROOT"
  [[ -f "$RELEASE_ROOT/apps/backend/package.json" ]] || fail "package.json do backend nao encontrado"
  [[ -f "$RELEASE_ROOT/apps/frontend/package.json" ]] || fail "package.json do frontend nao encontrado"
}

run_pnpm() {
  (cd "$RELEASE_ROOT" && "$@")
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  local sleep_seconds="${4:-2}"
  local pid_file="${5:-}"
  local attempt=1

  log "Aguardando $label em $url"
  while [[ "$attempt" -le "$attempts" ]]; do
    if [[ -n "$pid_file" ]] && ! is_pid_file_running "$pid_file"; then
      log "Processo associado a $label encerrou antes do healthcheck responder"
      return 1
    fi

    if curl --silent --show-error --fail --connect-timeout 2 --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi

    if (( attempt == 1 || attempt % 5 == 0 )); then
      log "Ainda aguardando $label (tentativa ${attempt}/${attempts})"
    fi
    sleep "$sleep_seconds"
    attempt=$((attempt + 1))
  done

  return 1
}

is_pid_file_running() {
  local pid_file="$1"
  local pid=""

  [[ -f "$pid_file" ]] || return 0
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" >/dev/null 2>&1
}

dump_log_tail() {
  local file_path="$1"
  local label="$2"

  if [[ -f "$file_path" ]]; then
    log "Ultimas linhas de $label:"
    tail -n 40 "$file_path" | while IFS= read -r line || [[ -n "$line" ]]; do
      printf '[deploy][tail:%s] %s\n' "$label" "$line"
    done
  fi
}

kill_pid_file() {
  local pid_file="$1"
  local label="$2"
  local pid=""

  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    wait "$pid" 2>/dev/null || true
  fi

  rm -f "$pid_file"
  log "$label finalizado"
}

cmd_preflight() {
  ensure_release_layout
  require_command node
  require_command corepack
  require_command curl

  [[ -f "$RELEASE_ROOT/apps/backend/.env" ]] || fail "apps/backend/.env precisa existir na release antes do deploy"

  log "Preflight da release OK em $RELEASE_ROOT"
}

cmd_full() {
  cmd_preflight
  log "Instalando dependencias da release"
  run_pnpm corepack pnpm install --frozen-lockfile
  log "Gerando Prisma Client"
  run_pnpm corepack pnpm --filter backend prisma:generate
  log "Buildando backend"
  run_pnpm corepack pnpm --filter backend build
  log "Buildando frontend"
  run_pnpm corepack pnpm -C apps/frontend run build:ci
  log "Validando layout standalone do frontend"
  run_pnpm corepack pnpm -C apps/frontend run check:standalone
  log "Empacotando assets publicos do frontend no standalone"
  package_frontend_runtime_assets
  log "Validando integridade do artefato standalone do frontend"
  validate_frontend_artifact_layout
  log "Aplicando migrations"
  run_pnpm corepack pnpm --filter backend prisma:migrate
  log "Executando seed versionado"
  run_pnpm corepack pnpm --filter backend seed:deploy
  log "Atualizando metadata da release"
  write_release_metadata
}

cmd_start_validation() {
  local host="$DEFAULT_VALIDATION_HOST"
  local backend_port="$DEFAULT_VALIDATION_BACKEND_PORT"
  local frontend_port="$DEFAULT_VALIDATION_FRONTEND_PORT"

  mkdir -p "$VALIDATION_DIR"
  cmd_stop_validation >/dev/null 2>&1 || true

  log "Subindo backend temporario em ${host}:${backend_port}"
  (
    cd "$RELEASE_ROOT/apps/backend"
    PROJECT_ROOT="$RELEASE_ROOT" \
    APP_BASE_DIR="$RELEASE_ROOT" \
    PORT="$backend_port" \
    HOST="$host" \
    nohup node dist/main.js >"$BACKEND_LOG_FILE" 2>&1 &
    printf '%s\n' "$!" >"$BACKEND_PID_FILE"
  )

  log "Subindo frontend temporario em ${host}:${frontend_port}"
  (
    cd "$RELEASE_ROOT/apps/frontend"
    PORT="$frontend_port" \
    HOSTNAME="$host" \
    NEXT_PUBLIC_API_URL="http://${host}:${backend_port}/api" \
    nohup node scripts/start-standalone.mjs >"$FRONTEND_LOG_FILE" 2>&1 &
    printf '%s\n' "$!" >"$FRONTEND_PID_FILE"
  )
}

cmd_health_validation() {
  local host="$DEFAULT_VALIDATION_HOST"
  local backend_port="$DEFAULT_VALIDATION_BACKEND_PORT"
  local frontend_port="$DEFAULT_VALIDATION_FRONTEND_PORT"
  local frontend_probe_dir="$VALIDATION_DIR/frontend-probe"
  local home_html_file="$frontend_probe_dir/home.html"
  local static_asset_path=""

  if ! wait_for_http "http://${host}:${backend_port}/api/health" "backend de validacao" 30 2 "$BACKEND_PID_FILE"; then
    dump_log_tail "$BACKEND_LOG_FILE" "validation-backend"
    dump_log_tail "$FRONTEND_LOG_FILE" "validation-frontend"
    fail "Healthcheck falhou para backend de validacao em http://${host}:${backend_port}/api/health"
  fi

  if ! wait_for_http "http://${host}:${frontend_port}" "frontend de validacao" 30 2 "$FRONTEND_PID_FILE"; then
    dump_log_tail "$BACKEND_LOG_FILE" "validation-backend"
    dump_log_tail "$FRONTEND_LOG_FILE" "validation-frontend"
    fail "Healthcheck falhou para frontend de validacao em http://${host}:${frontend_port}"
  fi

  mkdir -p "$frontend_probe_dir"
  curl --silent --show-error --fail "http://${host}:${frontend_port}" -o "$home_html_file"
  static_asset_path="$(extract_first_static_asset_path "$home_html_file")"
  if [[ -z "$static_asset_path" ]]; then
    dump_log_tail "$BACKEND_LOG_FILE" "validation-backend"
    dump_log_tail "$FRONTEND_LOG_FILE" "validation-frontend"
    fail "Nao foi possivel localizar nenhum asset em /_next/static na release de validacao"
  fi
  if ! wait_for_http "http://${host}:${frontend_port}${static_asset_path}" "asset estatico do frontend de validacao" 30 2 "$FRONTEND_PID_FILE"; then
    dump_log_tail "$BACKEND_LOG_FILE" "validation-backend"
    dump_log_tail "$FRONTEND_LOG_FILE" "validation-frontend"
    fail "Healthcheck falhou para asset estatico do frontend de validacao em http://${host}:${frontend_port}${static_asset_path}"
  fi
  log "Healthcheck da validacao temporaria OK"
}

cmd_stop_validation() {
  kill_pid_file "$BACKEND_PID_FILE" "Backend de validacao"
  kill_pid_file "$FRONTEND_PID_FILE" "Frontend de validacao"
}

cmd_activate() {
  local backend_name=""
  local frontend_name=""
  local backend_port=""
  local frontend_port=""

  require_command pm2
  : "${APP_INSTANCE_NAME:?APP_INSTANCE_NAME precisa estar definido para activate}"

  backend_name="${APP_INSTANCE_NAME}-backend"
  frontend_name="${APP_INSTANCE_NAME}-frontend"
  backend_port="$(resolve_backend_port)"
  frontend_port="$(resolve_frontend_port)"

  log "Ativando release publicada para a instancia $APP_INSTANCE_NAME"
  pm2 delete "$backend_name" >/dev/null 2>&1 || true
  pm2 delete "$frontend_name" >/dev/null 2>&1 || true

  PROJECT_ROOT="$RELEASE_ROOT" \
  APP_BASE_DIR="$RELEASE_ROOT" \
  PORT="$backend_port" \
  pm2 start dist/main.js --name "$backend_name" --cwd "$RELEASE_ROOT/apps/backend" --update-env

  PORT="$frontend_port" \
  HOSTNAME="0.0.0.0" \
  pm2 start "node scripts/start-standalone.mjs" --name "$frontend_name" --cwd "$RELEASE_ROOT/apps/frontend" --update-env

  pm2 save >/dev/null
}

cmd_health_published() {
  local host="${PUBLISHED_HOST:-127.0.0.1}"
  local backend_port=""
  local frontend_port=""
  local published_probe_dir="$VALIDATION_DIR/published-probe"
  local home_html_file="$published_probe_dir/home.html"
  local static_asset_path=""

  backend_port="$(resolve_backend_port)"
  frontend_port="$(resolve_frontend_port)"

  wait_for_http "http://${host}:${backend_port}/api/health" "backend publicado" || fail "Healthcheck falhou para backend publicado em http://${host}:${backend_port}/api/health"
  wait_for_http "http://${host}:${frontend_port}" "frontend publicado" || fail "Healthcheck falhou para frontend publicado em http://${host}:${frontend_port}"
  mkdir -p "$published_probe_dir"
  curl --silent --show-error --fail "http://${host}:${frontend_port}" -o "$home_html_file"
  static_asset_path="$(extract_first_static_asset_path "$home_html_file")"
  if [[ -z "$static_asset_path" ]]; then
    fail "Nao foi possivel localizar nenhum asset em /_next/static na release publicada"
  fi
  wait_for_http "http://${host}:${frontend_port}${static_asset_path}" "asset estatico do frontend publicado" || fail "Healthcheck falhou para asset estatico do frontend publicado em http://${host}:${frontend_port}${static_asset_path}"
  log "Healthcheck da release publicada OK"
}

cmd_version() {
  if [[ -f "$RELEASE_ROOT/VERSION" ]]; then
    head -n 1 "$RELEASE_ROOT/VERSION" | tr -d '\r'
    return 0
  fi

  node -p "require('./apps/backend/package.json').version" 2>/dev/null || printf 'unknown\n'
}

main() {
  local command="${1:-}"

  cd "$RELEASE_ROOT"

  case "$command" in
    preflight)
      cmd_preflight
      ;;
    full)
      cmd_full
      ;;
    start-validation)
      cmd_start_validation
      ;;
    health)
      cmd_health_validation
      ;;
    stop-validation)
      cmd_stop_validation
      ;;
    activate)
      cmd_activate
      ;;
    published-health)
      cmd_health_published
      ;;
    version)
      cmd_version
      ;;
    *)
      cat <<'EOF' >&2
Uso:
  bash Scripts/deploy.sh preflight
  bash Scripts/deploy.sh full
  bash Scripts/deploy.sh start-validation
  bash Scripts/deploy.sh health
  bash Scripts/deploy.sh stop-validation
  bash Scripts/deploy.sh activate
  bash Scripts/deploy.sh published-health
  bash Scripts/deploy.sh version
EOF
      exit 1
      ;;
  esac
}

main "$@"
