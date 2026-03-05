#!/usr/bin/env bash
# =============================================================================
# Retencao de releases para modelo BASE_DIR/releases
# Mantem:
#   - current
#   - previous
#   - ultimos N releases por data de modificacao
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
APP_BASE_DIR="${APP_BASE_DIR:-}"
RELEASES_TO_KEEP="${RELEASES_TO_KEEP:-5}"

log() {
  echo "[release-retention] $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_err() {
  echo "[release-retention] ERROR: $*" >&2
}

usage() {
  cat <<'EOF'
Uso:
  bash install/release-retention.sh [opcoes]

Opcoes:
  --base-dir <dir>     Define BASE_DIR (padrao: APP_BASE_DIR ou autodetect)
  --keep <N>           Mantem N releases mais recentes (padrao: 5)
  --help               Mostra ajuda
EOF
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
  cd "$candidate"
  pwd
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --base-dir)
        APP_BASE_DIR="$2"
        shift 2
        ;;
      --keep)
        RELEASES_TO_KEEP="$2"
        shift 2
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

  if ! [[ "$RELEASES_TO_KEEP" =~ ^[0-9]+$ ]]; then
    log_err "--keep deve ser inteiro >= 1"
    exit 1
  fi
  if (( RELEASES_TO_KEEP < 1 )); then
    RELEASES_TO_KEEP=1
  fi

  local base_dir
  base_dir="$(resolve_base_dir)"
  local releases_dir="${base_dir}/releases"
  local current_link="${base_dir}/current"
  local previous_link="${base_dir}/previous"

  if [[ ! -d "$releases_dir" ]]; then
    log "Diretorio de releases nao encontrado: $releases_dir"
    return 0
  fi

  local current_target=""
  local previous_target=""
  if [[ -L "$current_link" ]]; then
    current_target="$(readlink -f "$current_link")"
  fi
  if [[ -L "$previous_link" ]]; then
    previous_target="$(readlink -f "$previous_link")"
  fi

  local tmp_list
  tmp_list="$(mktemp)"
  local release_dir=""
  while IFS= read -r release_dir; do
    [[ -d "$release_dir" ]] || continue
    printf '%s\t%s\n' "$(stat -c '%Y' "$release_dir")" "$release_dir" >> "$tmp_list"
  done < <(find "$releases_dir" -mindepth 1 -maxdepth 1 -type d | sort)

  if [[ ! -s "$tmp_list" ]]; then
    rm -f "$tmp_list"
    log "Nenhum release encontrado para retencao."
    return 0
  fi

  local keep_count=0
  local deleted_count=0
  while IFS=$'\t' read -r _ release_path; do
    [[ -n "$release_path" ]] || continue

    if [[ "$release_path" == "$current_target" ]] || [[ "$release_path" == "$previous_target" ]]; then
      log "Mantendo release protegida: $release_path"
      continue
    fi

    keep_count=$((keep_count + 1))
    if (( keep_count <= RELEASES_TO_KEEP )); then
      log "Mantendo release recente: $release_path"
      continue
    fi

    rm -rf "$release_path"
    deleted_count=$((deleted_count + 1))
    log "Release removida por retencao: $release_path"
  done < <(sort -rn "$tmp_list")

  rm -f "$tmp_list"
  log "Retencao concluida. Releases removidas: $deleted_count"
}

main "$@"

