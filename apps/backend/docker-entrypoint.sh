#!/bin/sh
set -e

# Simple entrypoint: wait for DB, generate prisma client, run optional migrations, start app.
# Configure RUN_MIGRATIONS=false to skip migrations in runtime (recommended to run them in CI/CD).

DB_HOST=$(echo "${DATABASE_URL}" | sed -n 's|.*@\\(.*\\):.*|\\1|p' || echo "localhost")
DB_PORT=${DB_PORT:-5432}

# Wait for DB readiness
echo "Waiting for database at ${DB_HOST}:${DB_PORT} ..."
for i in $(seq 1 30); do
  if pg_isready -h "${DB_HOST}" -p "${DB_PORT}" > /dev/null 2>&1; then
    echo "Database is ready."
    break
  fi
  echo "Waiting for Postgres... (${i}/30)"
  sleep 2
done

PRISMA_BIN="/app/apps/backend/node_modules/.bin/prisma"
PRISMA_SCHEMA="/app/prisma/schema.prisma"

# Generate Prisma client (safe, uses installed prisma)
echo "Generating Prisma client..."
"${PRISMA_BIN}" generate --schema "${PRISMA_SCHEMA}" || npx --yes prisma generate --schema "${PRISMA_SCHEMA}"

# Optionally run migrations (disabled by default)
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running prisma migrate deploy..."
  "${PRISMA_BIN}" migrate deploy --schema "${PRISMA_SCHEMA}" || echo "prisma migrate failed (continuing)"
fi

# Start the app using package.json start:prod script (keeps runtime consistent)
exec npm run start:prod
