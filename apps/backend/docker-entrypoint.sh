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

# Extrai DB_HOST do DATABASE_URL se não estiver definido como variável de ambiente
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
else
  # Fallback: espera TCP simples
  i=0
  while [ $i -lt $DB_WAIT_TIMEOUT ]; do
    if nc -z "${DB_HOST}" "${DB_PORT}" >/dev/null 2>&1; then
      echo "Database is ready (nc)."
      break
    fi
    i=$((i + 1))
    sleep 1
  done
fi

# Localiza o CLI do Prisma de forma robusta
# O pnpm coloca o prisma em /app/node_modules/.bin/prisma ou ./node_modules/.bin/prisma
if [ -x "/app/node_modules/.bin/prisma" ]; then
  PRISMA_CMD="/app/node_modules/.bin/prisma"
elif [ -x "./node_modules/.bin/prisma" ]; then
  PRISMA_CMD="./node_modules/.bin/prisma"
else
  PRISMA_CMD="npx prisma"
fi

# Executa as migrations
echo "Running prisma migrate deploy..."
if ! $PRISMA_CMD migrate deploy --schema "$PRISMA_SCHEMA"; then
  echo "WARNING: prisma migrate deploy failed. Attempting db push as fallback..."
  if ! $PRISMA_CMD db push --schema "$PRISMA_SCHEMA" --skip-generate; then
    echo "ERROR: Both migrate deploy and db push failed."
    exit 1
  fi
fi

# Executa o seed (idempotente)
# O seed compilado está em dist/prisma/seed.js
SEED_FILE="./dist/prisma/seed.js"
if [ -f "$SEED_FILE" ]; then
  echo "Running application seed (idempotent)..."
  node "$SEED_FILE" || echo "WARNING: Seed returned non-zero exit code (may be safe to ignore on re-runs)."
else
  echo "Seed disabled: $SEED_FILE not found."
fi

echo "Starting NestJS application..."
# O NestJS compilado está em ./dist/main.js
exec node dist/main.js
