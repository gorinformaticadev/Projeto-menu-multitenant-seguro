#!/bin/sh
set -e

# ============================================================
# Entrypoint do backend NestJS - Projeto Multitenant
# ============================================================

# Caminhos baseados no WORKDIR=/app/apps/backend
PRISMA_SCHEMA="./prisma/schema.prisma"
MIGRATIONS_DIR="./prisma/migrations"

# Validações de ambiente
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not configured."
  exit 1
fi

if [ ! -f "$PRISMA_SCHEMA" ]; then
  echo "ERROR: Prisma schema not found at $PRISMA_SCHEMA."
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ] || [ -z "$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)" ]; then
  echo "ERROR: No Prisma versioned migrations found in $MIGRATIONS_DIR."
  echo "migrate deploy requires committed migrations."
  exit 1
fi

# Extrai DB_HOST do DATABASE_URL se não estiver definido como variável de ambiente
# Suporta: postgresql://user:pass@host:port/db e postgresql://user:pass@host/db
if [ -z "${DB_HOST:-}" ]; then
  DB_HOST=$(echo "${DATABASE_URL}" | sed -n 's|.*@\([^:/]*\)[:/].*|\1|p')
  if [ -z "$DB_HOST" ]; then
    DB_HOST="db"
  fi
fi

DB_PORT="${DB_PORT:-5432}"
DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-90}"

echo "Waiting for database at ${DB_HOST}:${DB_PORT} (timeout: ${DB_WAIT_TIMEOUT}s)..."

# Aguarda o banco de dados usando pg_isready se disponível, senão usa TCP
if command -v pg_isready >/dev/null 2>&1; then
  i=0
  max_attempts=$((DB_WAIT_TIMEOUT / 2))
  while [ $i -lt $max_attempts ]; do
    if pg_isready -h "${DB_HOST}" -p "${DB_PORT}" >/dev/null 2>&1; then
      echo "Database is ready (pg_isready)."
      break
    fi
    i=$((i + 1))
    echo "Waiting for Postgres... (${i}/${max_attempts})"
    sleep 2
  done
  if [ $i -ge $max_attempts ]; then
    echo "ERROR: Database did not become ready in time (${DB_WAIT_TIMEOUT}s)."
    exit 1
  fi
else
  # Fallback: espera TCP com Node.js
  node <<NODE
const net = require('net');
const host = '${DB_HOST}';
const port = ${DB_PORT};
const maxAttempts = ${DB_WAIT_TIMEOUT};
let attempts = 0;
function tryConnect() {
  attempts += 1;
  const socket = net.createConnection({ host, port });
  let handled = false;
  const finish = (ok, message) => {
    if (handled) return;
    handled = true;
    socket.destroy();
    if (ok) { console.log('Database is ready.'); process.exit(0); }
    if (attempts >= maxAttempts) {
      console.error('ERROR: Database did not become ready in time. Last error: ' + message);
      process.exit(1);
    }
    setTimeout(tryConnect, 1000);
  };
  socket.setTimeout(1000);
  socket.on('connect', () => finish(true, 'connected'));
  socket.on('timeout', () => finish(false, 'timeout'));
  socket.on('error', (err) => finish(false, err && err.message ? err.message : String(err)));
}
tryConnect();
NODE
fi

# Localiza o CLI do Prisma
if [ -x "./node_modules/.bin/prisma" ]; then
  PRISMA_CMD="./node_modules/.bin/prisma"
elif command -v prisma >/dev/null 2>&1; then
  PRISMA_CMD="prisma"
else
  echo "ERROR: Prisma CLI not found in container."
  exit 1
fi

# Executa as migrations
echo "Running prisma migrate deploy..."
if ! MIGRATE_OUTPUT="$($PRISMA_CMD migrate deploy --schema "$PRISMA_SCHEMA" 2>&1)"; then
  echo "$MIGRATE_OUTPUT"
  echo "ERROR: prisma migrate deploy failed. Attempting db push as fallback..."
  if ! $PRISMA_CMD db push --schema "$PRISMA_SCHEMA" --skip-generate 2>&1; then
    echo "ERROR: Both migrate deploy and db push failed. Refusing to continue."
    exit 1
  fi
  echo "WARNING: Used db push as fallback. Consider creating proper migrations."
else
  echo "$MIGRATE_OUTPUT"
fi

# Executa o seed (idempotente)
SEED_FILE="./dist/prisma/seed.js"
if [ -f "$SEED_FILE" ]; then
  echo "Running application seed (idempotent)..."
  export INSTALL_ADMIN_EMAIL="${INSTALL_ADMIN_EMAIL:-}"
  export INSTALL_ADMIN_PASSWORD="${INSTALL_ADMIN_PASSWORD:-}"
  node "$SEED_FILE" || echo "WARNING: Seed returned non-zero exit code (may be safe to ignore on re-runs)."
else
  echo "Seed disabled: $SEED_FILE not found."
fi

echo "Starting NestJS application..."
exec node dist/main.js
