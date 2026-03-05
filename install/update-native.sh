#!/usr/bin/env bash
# =============================================================================
# Atualizador Native (PM2) - modelo atomico releases/current/shared
# =============================================================================
# Estrutura:
#   BASE_DIR/releases/<version>
#   BASE_DIR/shared
#   BASE_DIR/current  -> release ativo
#   BASE_DIR/previous -> release anterior
#
# Suporta modo legado in-place com --legacy-inplace (default OFF).
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

TARGET_TAG="${TARGET_TAG:-${RELEASE_TAG:-latest}}"
APP_BASE_DIR="${APP_BASE_DIR:-}"
GIT_REPO_URL="${GIT_REPO_URL:-}"
GIT_AUTH_HEADER="${GIT_AUTH_HEADER:-}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
RELEASES_TO_KEEP="${RELEASES_TO_KEEP:-5}"
LEGACY_INPLACE="false"

BASE_DIR=""
RELEASES_DIR=""
SHARED_DIR=""
CURRENT_LINK=""
PREVIOUS_LINK=""
LOCK_FILE=""
LOCK_FD=99

RESOLVED_APP_VERSION="unknown"
RESOLVED_GIT_SHA="unknown"
RESOLVED_BUILD_TIME="unknown"
RESOLVED_BRANCH=""
BACKEND_PROC=""
FRONTEND_PROC=""

log() {
  echo "[native-deploy] $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_err() {
  echo "[native-deploy] ERROR: $*" >&2
}

usage() {
  cat <<'EOF'
Uso:
  bash install/update-native.sh [opcoes]

Opcoes:
  --tag <tag>            Define tag alvo (padrao: env TARGET_TAG/RELEASE_TAG)
  --base-dir <dir>       Define BASE_DIR (padrao: APP_BASE_DIR ou autodetect)
  --legacy-inplace       Executa update antigo in-place (compatibilidade)
  --help                 Mostra ajuda
EOF
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/}"
  echo "$value"
}

sanitize_release_name() {
  local value="$1"
  value="${value//\//_}"
  value="${value// /_}"
  value="$(echo "$value" | tr -cd '[:alnum:]._+-')"
  if [[ -z "$value" ]]; then
    value="unknown"
  fi
  echo "$value"
}

ensure_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_err "Comando obrigatorio nao encontrado: $cmd"
    exit 1
  fi
}

normalize_repo_web_url() {
  local raw="$1"
  local normalized="$raw"
  normalized="${normalized%.git}"
  if [[ "$normalized" =~ ^git@github.com:(.+/.+)$ ]]; then
    normalized="https://github.com/${BASH_REMATCH[1]}"
  fi
  echo "$normalized"
}

get_link_target() {
  local link_path="$1"
  if [[ -L "$link_path" ]]; then
    readlink -f "$link_path"
  else
    echo ""
  fi
}

update_env_file() {
  local key="$1"
  local value="$2"
  local file="$3"
  local escaped_key
  escaped_key="$(printf '%s\n' "$key" | sed 's/[][\/.^$*]/\\&/g')"
  if grep -qE "^${escaped_key}=" "$file" 2>/dev/null; then
    sed -i "s|^${escaped_key}=.*|${key}=${value}|g" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

resolve_base_dir() {
  local candidate="${APP_BASE_DIR}"
  if [[ -z "$candidate" ]]; then
    candidate="$PROJECT_ROOT"
    if [[ "$(basename "$candidate")" == "current" ]]; then
      candidate="$(dirname "$candidate")"
    elif [[ "$(basename "$(dirname "$candidate")")" == "releases" ]]; then
      candidate="$(dirname "$(dirname "$candidate")")"
    fi
  fi
  BASE_DIR="$(cd "$candidate" && pwd)"
  RELEASES_DIR="$BASE_DIR/releases"
  SHARED_DIR="$BASE_DIR/shared"
  CURRENT_LINK="$BASE_DIR/current"
  PREVIOUS_LINK="$BASE_DIR/previous"
  LOCK_FILE="$SHARED_DIR/locks/update.lock"
}

prepare_base_layout() {
  mkdir -p "$RELEASES_DIR" "$SHARED_DIR/uploads" "$SHARED_DIR/backups" "$SHARED_DIR/logs" "$SHARED_DIR/locks"
}

bootstrap_legacy_layout_if_needed() {
  if [[ -L "$CURRENT_LINK" ]]; then
    return 0
  fi

  if [[ -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]]; then
    log_err "Caminho $CURRENT_LINK existe mas nao eh symlink. Ajuste manual necessario."
    exit 1
  fi

  if [[ ! -d "$PROJECT_ROOT/apps/backend" ]]; then
    log_err "Nao foi possivel detectar raiz legacy para bootstrap (apps/backend ausente em $PROJECT_ROOT)."
    exit 1
  fi

  local detected_version="legacy-$(date -u +%Y%m%dT%H%M%SZ)"
  if [[ -f "$PROJECT_ROOT/VERSION" ]]; then
    local file_version
    file_version="$(head -n1 "$PROJECT_ROOT/VERSION" | tr -d '\r' || true)"
    if [[ -n "$file_version" ]]; then
      detected_version="$file_version"
    fi
  fi
  local bootstrap_release="$RELEASES_DIR/$(sanitize_release_name "$detected_version")"
  log "Bootstrap da estrutura atomica: criando release base em $bootstrap_release"

  if [[ ! -d "$bootstrap_release" ]]; then
    mkdir -p "$bootstrap_release"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete \
        --exclude 'releases' \
        --exclude 'shared' \
        --exclude 'current' \
        --exclude 'previous' \
        "$BASE_DIR/" "$bootstrap_release/"
    else
      tar -C "$BASE_DIR" \
        --exclude './releases' \
        --exclude './shared' \
        --exclude './current' \
        --exclude './previous' \
        -cf - . | tar -C "$bootstrap_release" -xf -
    fi
  fi

  ln -sfn "$bootstrap_release" "$CURRENT_LINK"
  log "Bootstrap concluido. current -> $bootstrap_release"
}

ensure_shared_env() {
  if [[ -f "$SHARED_DIR/.env" ]]; then
    return 0
  fi

  local candidates=(
    "$PROJECT_ROOT/apps/backend/.env"
    "$PROJECT_ROOT/.env"
    "$CURRENT_LINK/apps/backend/.env"
    "$CURRENT_LINK/.env"
  )
  local candidate=""
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      cp "$candidate" "$SHARED_DIR/.env"
      log "Arquivo shared/.env criado a partir de: $candidate"
      return 0
    fi
  done

  log_err "shared/.env nao encontrado e nenhum .env legado disponivel para migracao."
  exit 1
}

ensure_shared_frontend_env() {
  if [[ -f "$SHARED_DIR/.env.frontend.local" ]]; then
    return 0
  fi

  local candidates=(
    "$PROJECT_ROOT/apps/frontend/.env.local"
    "$CURRENT_LINK/apps/frontend/.env.local"
  )
  local candidate=""
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      cp "$candidate" "$SHARED_DIR/.env.frontend.local"
      return 0
    fi
  done
}

acquire_lock() {
  eval "exec ${LOCK_FD}>\"${LOCK_FILE}\""
  if ! flock -n "$LOCK_FD"; then
    log_err "Update em andamento. Lock ativo em $LOCK_FILE"
    exit 1
  fi
  printf '%s\n' "$$" 1>&"$LOCK_FD" || true
}

release_lock() {
  flock -u "$LOCK_FD" || true
  eval "exec ${LOCK_FD}>&-"
}

validate_release_dir() {
  local release_dir="$1"
  [[ -f "$release_dir/pnpm-workspace.yaml" ]] &&
  [[ -f "$release_dir/package.json" ]] &&
  [[ -d "$release_dir/apps/backend" ]] &&
  [[ -d "$release_dir/apps/frontend" ]] &&
  [[ -d "$release_dir/install" ]]
}

download_release_tarball() {
  local target_tag="$1"
  local release_dir="$2"
  local repo_web_url
  repo_web_url="$(normalize_repo_web_url "$GIT_REPO_URL")"
  if [[ ! "$repo_web_url" =~ ^https://github.com/.+/.+$ ]]; then
    return 1
  fi

  ensure_command curl
  ensure_command tar
  local tarball_url="${repo_web_url}/archive/refs/tags/${target_tag}.tar.gz"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  local archive_file="${tmp_dir}/release.tar.gz"

  log "Baixando release tarball: ${tarball_url}"
  if [[ -n "$GIT_AUTH_HEADER" ]]; then
    curl -fsSL -H "$GIT_AUTH_HEADER" "$tarball_url" -o "$archive_file"
  else
    curl -fsSL "$tarball_url" -o "$archive_file"
  fi

  tar -xzf "$archive_file" -C "$tmp_dir"
  local extracted_dir
  extracted_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d | head -n1)"
  if [[ -z "$extracted_dir" ]]; then
    log_err "Falha ao extrair tarball da release."
    rm -rf "$tmp_dir"
    return 1
  fi

  mkdir -p "$release_dir"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$extracted_dir/" "$release_dir/"
  else
    rm -rf "$release_dir"
    mkdir -p "$release_dir"
    cp -a "$extracted_dir/." "$release_dir/"
  fi
  rm -rf "$tmp_dir"
  return 0
}

download_release_git_clone() {
  local target_tag="$1"
  local release_dir="$2"
  ensure_command git
  if [[ -z "$GIT_REPO_URL" ]]; then
    log_err "GIT_REPO_URL nao informado e tarball indisponivel."
    exit 1
  fi
  log "Tarball indisponivel. Fazendo git clone da tag ${target_tag}..."
  if [[ -n "$GIT_AUTH_HEADER" ]]; then
    git -c "http.extraHeader=${GIT_AUTH_HEADER}" clone --depth 1 --branch "$target_tag" "$GIT_REPO_URL" "$release_dir"
  else
    git clone --depth 1 --branch "$target_tag" "$GIT_REPO_URL" "$release_dir"
  fi
}

ensure_release_code() {
  local target_tag="$1"
  local release_dir="$2"
  if [[ -d "$release_dir" ]]; then
    if validate_release_dir "$release_dir"; then
      log "Release ${target_tag} ja existe em ${release_dir}. Reutilizando."
      return 0
    fi
    log_err "Release existente em ${release_dir} esta inconsistente."
    exit 1
  fi

  if [[ -n "$GIT_REPO_URL" ]] && download_release_tarball "$target_tag" "$release_dir"; then
    :
  else
    download_release_git_clone "$target_tag" "$release_dir"
  fi

  if ! validate_release_dir "$release_dir"; then
    log_err "Release ${target_tag} baixada sem estrutura valida."
    exit 1
  fi
}

resolve_build_metadata() {
  local release_dir="$1"
  RESOLVED_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  RESOLVED_APP_VERSION="${APP_VERSION:-$TARGET_TAG}"
  RESOLVED_GIT_SHA="${BUILD_COMMIT_SHA:-unknown}"
  RESOLVED_BRANCH="${BUILD_BRANCH:-}"

  if [[ -f "$release_dir/VERSION" ]]; then
    local existing_version
    existing_version="$(head -n1 "$release_dir/VERSION" | tr -d '\r' || true)"
    if [[ -n "$existing_version" ]] && [[ "${APP_VERSION:-}" == "" ]]; then
      RESOLVED_APP_VERSION="$existing_version"
    fi
  fi

  if [[ -d "$release_dir/.git" ]] && command -v git >/dev/null 2>&1; then
    local full_sha
    full_sha="$(git -C "$release_dir" rev-parse HEAD 2>/dev/null || true)"
    if [[ -n "$full_sha" ]]; then
      RESOLVED_GIT_SHA="$full_sha"
    fi
    local branch_name
    branch_name="$(git -C "$release_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    if [[ -n "$branch_name" ]]; then
      RESOLVED_BRANCH="$branch_name"
    fi
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

link_shared_into_release() {
  local release_dir="$1"
  ln -sfn "$SHARED_DIR/.env" "$release_dir/.env"
  mkdir -p "$release_dir/apps/backend"
  ln -sfn "$SHARED_DIR/.env" "$release_dir/apps/backend/.env"
  mkdir -p "$release_dir/apps/frontend"
  if [[ -f "$SHARED_DIR/.env.frontend.local" ]]; then
    ln -sfn "$SHARED_DIR/.env.frontend.local" "$release_dir/apps/frontend/.env.local"
  fi
  ln -sfn "$SHARED_DIR/uploads" "$release_dir/uploads"
  ln -sfn "$SHARED_DIR/backups" "$release_dir/backups"
}

discover_pm2_name() {
  local token="$1"
  pm2 jlist 2>/dev/null | grep -oE "\"name\":\"[^\"]*${token}[^\"]*\"" | head -n1 | cut -d'"' -f4 || true
}

restart_pm2_processes() {
  local target_root="$1"
  local backend_name="${PM2_BACKEND_NAME:-$BACKEND_PROC}"
  local frontend_name="${PM2_FRONTEND_NAME:-$FRONTEND_PROC}"

  if [[ -z "$backend_name" ]]; then
    backend_name="multitenant-backend"
  fi
  if [[ -z "$frontend_name" ]]; then
    frontend_name="multitenant-frontend"
  fi

  log "Reiniciando PM2 com codigo em ${target_root}"
  pm2 delete "$backend_name" >/dev/null 2>&1 || true
  pm2 delete "$frontend_name" >/dev/null 2>&1 || true

  pm2 start dist/main.js --name "$backend_name" --cwd "$target_root/apps/backend" --update-env
  pm2 start "pnpm start" --name "$frontend_name" --cwd "$target_root/apps/frontend" --update-env
  pm2 save

  BACKEND_PROC="$backend_name"
  FRONTEND_PROC="$frontend_name"
}

load_runtime_env_from_shared() {
  set -a
  # shellcheck disable=SC1090
  source "$SHARED_DIR/.env"
  set +a
}

wait_for_http_ok() {
  local url="$1"
  local timeout="$2"
  local label="$3"
  local started_at
  started_at="$(date +%s)"

  while true; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      log "${label} OK: ${url}"
      return 0
    fi
    local now
    now="$(date +%s)"
    if (( now - started_at >= timeout )); then
      log_err "Timeout no healthcheck de ${label}: ${url}"
      return 1
    fi
    sleep "$HEALTH_INTERVAL"
  done
}

run_healthchecks() {
  load_runtime_env_from_shared
  local backend_port="${PORT:-4000}"
  local frontend_port="${FRONTEND_PORT:-5000}"
  local backend_url="${BACKEND_HEALTH_URL:-http://127.0.0.1:${backend_port}/api/health}"
  local frontend_url="${FRONTEND_HEALTH_URL:-http://127.0.0.1:${frontend_port}/}"

  wait_for_http_ok "$backend_url" "$HEALTH_TIMEOUT" "backend"
  wait_for_http_ok "$frontend_url" "$HEALTH_TIMEOUT" "frontend"
}

prepare_release_build() {
  local release_dir="$1"
  log "Preparando release (deps/build/migrate/seed): $release_dir"
  (
    cd "$release_dir"
    pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
    pnpm --filter backend build
    (
      cd apps/backend
      pnpm exec prisma generate
      pnpm exec tsc prisma/seed.ts --outDir dist/prisma --skipLibCheck --module commonjs --target ES2021 --esModuleInterop --resolveJsonModule
    )
    pnpm --filter frontend build
    (
      cd apps/backend
      set -a
      # shellcheck disable=SC1091
      source ./.env
      set +a
      pnpm exec prisma migrate deploy --schema prisma/schema.prisma
      node dist/prisma/seed.js deploy
    )
  )
}

create_pre_swap_backup() {
  local from_version="$1"
  local to_version="$2"
  ensure_command tar
  ensure_command pg_dump

  load_runtime_env_from_shared
  if [[ -z "${DATABASE_URL:-}" ]]; then
    log_err "DATABASE_URL ausente no shared/.env. Backup obrigatorio falhou."
    exit 1
  fi

  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local from_safe
  local to_safe
  from_safe="$(sanitize_release_name "$from_version")"
  to_safe="$(sanitize_release_name "$to_version")"
  local backup_dir="$SHARED_DIR/backups/${stamp}_${from_safe}_to_${to_safe}"
  mkdir -p "$backup_dir"

  log "Gerando backup pre-swap em $backup_dir"
  cp "$SHARED_DIR/.env" "$backup_dir/.env.snapshot"
  tar -C "$SHARED_DIR" -czf "$backup_dir/uploads.tar.gz" uploads
  pg_dump --format=custom --no-owner --no-privileges --file "$backup_dir/database.dump" "$DATABASE_URL"

  printf '{\n  "fromVersion": "%s",\n  "toVersion": "%s",\n  "createdAt": "%s",\n  "dbDumpPath": "%s",\n  "uploadsArchivePath": "%s",\n  "envSnapshotPath": "%s"\n}\n' \
    "$(json_escape "$from_version")" \
    "$(json_escape "$to_version")" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$(json_escape "$backup_dir/database.dump")" \
    "$(json_escape "$backup_dir/uploads.tar.gz")" \
    "$(json_escape "$backup_dir/.env.snapshot")" > "$backup_dir/manifest.json"
}

run_release_retention() {
  local retention_script="$SCRIPT_DIR/release-retention.sh"
  if [[ -f "$retention_script" ]]; then
    bash "$retention_script" --base-dir "$BASE_DIR" --keep "$RELEASES_TO_KEEP" || \
      log "Aviso: release-retention falhou; seguindo sem bloquear update."
  else
    log "Aviso: install/release-retention.sh nao encontrado; retencao ignorada."
  fi
}

rollback_after_failed_health() {
  local previous_target="$1"
  if [[ -z "$previous_target" ]] || [[ ! -d "$previous_target" ]]; then
    log_err "Rollback automatico indisponivel (previous invalido)."
    return 1
  fi

  log "Healthcheck falhou. Aplicando rollback para $previous_target"
  ln -sfn "$previous_target" "$CURRENT_LINK"
  restart_pm2_processes "$CURRENT_LINK"
  if ! run_healthchecks; then
    log_err "Rollback aplicado, mas healthcheck ainda falhando."
  fi
  log "ROLLBACK_COMPLETED: rollback automatico concluido"
  return 0
}

run_legacy_inplace() {
  ensure_command git
  ensure_command pnpm
  ensure_command pm2
  if [[ -z "$GIT_REPO_URL" ]]; then
    log_err "Modo --legacy-inplace requer GIT_REPO_URL."
    exit 1
  fi

  log "Executando modo legado in-place para ${TARGET_TAG}"
  (
    cd "$PROJECT_ROOT"
    if [[ -n "$GIT_AUTH_HEADER" ]]; then
      git -c "http.extraHeader=${GIT_AUTH_HEADER}" fetch --tags --prune origin
    else
      git fetch --tags --prune origin
    fi
    git checkout "$TARGET_TAG"
    resolve_build_metadata "$PROJECT_ROOT"
    write_build_metadata_files "$PROJECT_ROOT"
    pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
    pnpm --filter backend build
    pnpm --filter frontend build
    (
      cd apps/backend
      pnpm exec prisma migrate deploy --schema prisma/schema.prisma
      node dist/prisma/seed.js deploy
    )
  )

  BACKEND_PROC="$(discover_pm2_name backend)"
  FRONTEND_PROC="$(discover_pm2_name frontend)"
  restart_pm2_processes "$PROJECT_ROOT"
  log "Modo legado concluido com sucesso."
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tag)
        TARGET_TAG="$2"
        shift 2
        ;;
      --base-dir)
        APP_BASE_DIR="$2"
        shift 2
        ;;
      --legacy-inplace)
        LEGACY_INPLACE="true"
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        log_err "Opcao invalida: $1"
        usage
        exit 1
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  ensure_command flock
  ensure_command curl
  ensure_command pnpm
  ensure_command pm2

  if [[ "$LEGACY_INPLACE" == "true" ]]; then
    run_legacy_inplace
    return 0
  fi

  resolve_base_dir
  prepare_base_layout
  acquire_lock
  trap release_lock EXIT

  log "STEP 1/10 - Atualizacao atomica iniciada (tag=${TARGET_TAG}, base=${BASE_DIR})"

  bootstrap_legacy_layout_if_needed
  ensure_shared_env
  ensure_shared_frontend_env

  export APP_BASE_DIR="$BASE_DIR"
  export UPLOADS_DIR="$SHARED_DIR/uploads"
  export BACKUP_DIR="$SHARED_DIR/backups"
  update_env_file "APP_BASE_DIR" "$BASE_DIR" "$SHARED_DIR/.env"
  update_env_file "UPLOADS_DIR" "$SHARED_DIR/uploads" "$SHARED_DIR/.env"
  update_env_file "BACKUP_DIR" "$SHARED_DIR/backups" "$SHARED_DIR/.env"

  local target_release_name
  target_release_name="$(sanitize_release_name "$TARGET_TAG")"
  local release_dir="$RELEASES_DIR/$target_release_name"

  log "STEP 2/10 - Preparando release em $release_dir"
  ensure_release_code "$TARGET_TAG" "$release_dir"
  resolve_build_metadata "$release_dir"
  write_build_metadata_files "$release_dir"
  link_shared_into_release "$release_dir"

  log "STEP 3/10 - Build/migrate da release alvo"
  prepare_release_build "$release_dir"

  local current_target
  current_target="$(get_link_target "$CURRENT_LINK")"
  local from_version="unknown"
  if [[ -n "$current_target" ]] && [[ -f "$current_target/VERSION" ]]; then
    from_version="$(head -n1 "$current_target/VERSION" | tr -d '\r' || echo unknown)"
  elif [[ -n "$current_target" ]]; then
    from_version="$(basename "$current_target")"
  fi

  local to_version="$RESOLVED_APP_VERSION"
  if [[ -z "$to_version" ]]; then
    to_version="$TARGET_TAG"
  fi

  log "STEP 4/10 - Backup obrigatorio pre-swap"
  create_pre_swap_backup "$from_version" "$to_version"

  BACKEND_PROC="$(discover_pm2_name backend)"
  FRONTEND_PROC="$(discover_pm2_name frontend)"

  local previous_target
  previous_target="$current_target"
  if [[ -n "$current_target" ]]; then
    ln -sfn "$current_target" "$PREVIOUS_LINK"
  fi

  if [[ "$current_target" == "$release_dir" ]]; then
    log "STEP 5/10 - Release alvo ja esta ativa em current. Reiniciando servicos."
  else
    log "STEP 5/10 - Swap atomico de symlink current"
    ln -sfn "$release_dir" "$CURRENT_LINK"
  fi

  log "STEP 6/10 - Reiniciando servicos PM2"
  restart_pm2_processes "$CURRENT_LINK"

  log "STEP 7/10 - Executando healthchecks"
  if ! run_healthchecks; then
    if rollback_after_failed_health "$previous_target"; then
      exit 2
    fi
    exit 1
  fi

  log "STEP 8/10 - Executando retencao de releases"
  run_release_retention

  log "STEP 9/10 - Versao ativa: ${to_version} | current -> $(get_link_target "$CURRENT_LINK")"
  log "STEP 10/10 - Update atomico concluido com sucesso"
}

main "$@"
