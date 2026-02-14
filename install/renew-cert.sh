#!/usr/bin/env bash
# =============================================================================
# Renovação de certificado Let's Encrypt (uso em cron, ex.: 0 3 * * *)
# =============================================================================
# Requer: certificado já obtido pelo instalador (obtain_letsencrypt_cert).
# Uso: sudo bash install/renew-cert.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_PRODUCTION="$SCRIPT_DIR/.env.production"
NGINX_CERTS_DIR="$PROJECT_ROOT/nginx/certs"
NGINX_WEBROOT="$PROJECT_ROOT/nginx/webroot"

if [[ ! -f "$ENV_PRODUCTION" ]]; then
    echo "Arquivo install/.env.production não encontrado."
    exit 1
fi

# shellcheck source=/dev/null
source "$ENV_PRODUCTION" 2>/dev/null || true
domain="${DOMAIN:-}"
email="${LETSENCRYPT_EMAIL:-}"

if [[ -z "$domain" || -z "$email" ]]; then
    echo "Defina DOMAIN e LETSENCRYPT_EMAIL em install/.env.production"
    exit 1
fi

mkdir -p "$NGINX_WEBROOT"

docker run --rm \
    -v "${NGINX_WEBROOT}:/var/www/certbot:rw" \
    -v "${NGINX_CERTS_DIR}:/etc/letsencrypt:rw" \
    certbot/certbot renew --webroot -w /var/www/certbot --quiet

if [[ -f "$NGINX_CERTS_DIR/live/$domain/fullchain.pem" ]] && [[ -f "$NGINX_CERTS_DIR/live/$domain/privkey.pem" ]]; then
    cp "$NGINX_CERTS_DIR/live/$domain/fullchain.pem" "$NGINX_CERTS_DIR/cert.pem"
    cp "$NGINX_CERTS_DIR/live/$domain/privkey.pem" "$NGINX_CERTS_DIR/key.pem"
    cd "$PROJECT_ROOT"
    docker compose --env-file "$ENV_PRODUCTION" -f docker-compose.prod.yml restart nginx 2>/dev/null || true
    echo "Certificado renovado e nginx reiniciado."
else
    echo "Renovação não alterou certificados ou caminho inválido (live/$domain)."
fi
