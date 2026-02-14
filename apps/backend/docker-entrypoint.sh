#!/bin/sh
set -e

# Simple entrypoint: wait for DB, generate prisma client, run optional migrations, start app.
# Configure RUN_MIGRATIONS=false to skip migrations in runtime (recommended to run them in CI/CD).

DB_HOST=$(echo "${DATABASE_URL}" | sed -n 's|.*@\\(.*\\):.*|\\1|p' || echo "localhost")
DB_PORT=${DB_PORT:-5432}

# Wait for DB readiness (pg_isready from postgresql-client package)
echo "Waiting for database at ${DB_HOST}:${DB_PORT} ..."
if command -v pg_isready >/dev/null 2>&1; then
  for i in $(seq 1 30); do
    if pg_isready -h "${DB_HOST}" -p "${DB_PORT}" >/dev/null 2>&1; then
      echo "Database is ready."
      break
    fi
    echo "Waiting for Postgres... (${i}/30)"
    sleep 2
  done
else
  echo "pg_isready not found; waiting 10s for DB to be up."
  sleep 10
fi

PRISMA_BIN="/app/apps/backend/node_modules/.bin/prisma"
PRISMA_SCHEMA="/app/prisma/schema.prisma"

# Optionally generate Prisma client in runtime (disabled by default).
# Client is already generated during image build.
if [ "${RUN_PRISMA_GENERATE:-false}" = "true" ]; then
  echo "Generating Prisma client..."
  "${PRISMA_BIN}" generate --schema "${PRISMA_SCHEMA}" || npx --yes prisma generate --schema "${PRISMA_SCHEMA}"
fi

# Optionally run migrations (disabled by default)
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running prisma migrate deploy..."
  "${PRISMA_BIN}" migrate deploy --schema "${PRISMA_SCHEMA}" || echo "prisma migrate failed (continuing)"
fi

# Start the app using package.json start:prod script (keeps runtime consistent)
exec npm run start:prod
