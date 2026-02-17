#!/bin/sh
set -eu

PRISMA_SCHEMA="/app/apps/backend/prisma/schema.prisma"
MIGRATIONS_DIR="/app/apps/backend/prisma/migrations"

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

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"

echo "Waiting for database at ${DB_HOST}:${DB_PORT} ..."
node <<'NODE'
const net = require('net');

const host = process.env.DB_HOST || 'db';
const port = Number(process.env.DB_PORT || 5432);
const timeoutSeconds = Number(process.env.DB_WAIT_TIMEOUT || 60);
const maxAttempts = Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? Math.floor(timeoutSeconds) : 60;

let attempts = 0;

function tryConnect() {
  attempts += 1;

  const socket = net.createConnection({ host, port });
  let handled = false;

  const finish = (ok, message) => {
    if (handled) return;
    handled = true;
    socket.destroy();

    if (ok) {
      console.log('Database is ready.');
      process.exit(0);
    }

    if (attempts >= maxAttempts) {
      console.error(`ERROR: Database did not become ready in time (${maxAttempts}s). Last error: ${message}`);
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

if [ -x "./node_modules/.bin/prisma" ]; then
  PRISMA_CMD="./node_modules/.bin/prisma"
elif command -v prisma >/dev/null 2>&1; then
  PRISMA_CMD="prisma"
else
  echo "ERROR: Prisma CLI not found in container."
  exit 1
fi

echo "Running prisma migrate deploy..."
if ! MIGRATE_OUTPUT="$($PRISMA_CMD migrate deploy --schema "$PRISMA_SCHEMA" 2>&1)"; then
  echo "$MIGRATE_OUTPUT"
  echo "ERROR: prisma migrate deploy failed. Refusing to continue."
  echo "Prisma migration status:"
  if ! $PRISMA_CMD migrate status --schema "$PRISMA_SCHEMA"; then
    echo "Unable to read migration status after failure."
  fi
  exit 1
fi
echo "$MIGRATE_OUTPUT"

if [ -f "/app/apps/backend/dist/prisma/seed.js" ]; then
  echo "Running application seed (idempotent)..."
  export INSTALL_ADMIN_EMAIL="${INSTALL_ADMIN_EMAIL:-}"
  export INSTALL_ADMIN_PASSWORD="${INSTALL_ADMIN_PASSWORD:-}"
  node /app/apps/backend/dist/prisma/seed.js
else
  echo "Seed disabled: /app/apps/backend/dist/prisma/seed.js not found."
fi

exec node dist/main.js
