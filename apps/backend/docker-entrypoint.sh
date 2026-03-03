#!/bin/sh
set -e

# ============================================================
# Entrypoint do backend NestJS - Projeto Multitenant
# ============================================================

PRISMA_SCHEMA="./prisma/schema.prisma"
MIGRATIONS_DIR="./prisma/migrations"
BACKUP_DIR="${BACKUP_DIR:-/app/apps/backend/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/apps/backend/uploads}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not configured."
  exit 1
fi

if [ -z "${DB_HOST:-}" ]; then
  DB_HOST=$(echo "${DATABASE_URL}" | sed -n 's|.*@\([^:/]*\)[:/].*|\1|p')
  if [ -z "$DB_HOST" ]; then
    DB_HOST="db"
  fi
fi

DB_PORT="${DB_PORT:-5432}"
DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-90}"

RUN_AS_APP=""
if [ "$(id -u)" -eq 0 ]; then
  mkdir -p "$BACKUP_DIR" "$UPLOAD_DIR"
  chown -R nestjs:nodejs "$BACKUP_DIR" "$UPLOAD_DIR" || true

  if command -v su-exec >/dev/null 2>&1; then
    RUN_AS_APP="su-exec nestjs:nodejs"
  else
    echo "WARNING: su-exec not found, backend will run as root."
  fi
fi

run_as_app() {
  if [ -n "$RUN_AS_APP" ]; then
    # shellcheck disable=SC2086
    $RUN_AS_APP "$@"
  else
    "$@"
  fi
}

echo "Waiting for database at ${DB_HOST}:${DB_PORT} (timeout: ${DB_WAIT_TIMEOUT}s)..."
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

if [ -x "/app/node_modules/.bin/prisma" ]; then
  PRISMA_CMD="/app/node_modules/.bin/prisma"
elif [ -x "./node_modules/.bin/prisma" ]; then
  PRISMA_CMD="./node_modules/.bin/prisma"
else
  echo "ERROR: prisma CLI not found."
  exit 1
fi

RUN_MIGRATE_DEPLOY=0
if [ -d "$MIGRATIONS_DIR" ]; then
  echo "Checking Prisma migration status..."
  set +e
  MIGRATION_STATUS_OUTPUT="$(run_as_app "$PRISMA_CMD" migrate status --schema "$PRISMA_SCHEMA" 2>&1)"
  MIGRATION_STATUS_EXIT=$?
  set -e

  echo "$MIGRATION_STATUS_OUTPUT"
  MIGRATION_STATUS_NORMALIZED=$(echo "$MIGRATION_STATUS_OUTPUT" | tr '[:upper:]' '[:lower:]')

  if echo "$MIGRATION_STATUS_NORMALIZED" | grep -q "database schema is up to date"; then
    echo "Migrations already up to date. Skipping migrate deploy."
  elif echo "$MIGRATION_STATUS_NORMALIZED" | grep -q "have not yet been applied"; then
    RUN_MIGRATE_DEPLOY=1
  elif echo "$MIGRATION_STATUS_NORMALIZED" | grep -q "current database is not managed by prisma migrate"; then
    RUN_MIGRATE_DEPLOY=1
  elif [ "$MIGRATION_STATUS_EXIT" -eq 0 ]; then
    RUN_MIGRATE_DEPLOY=1
  else
    echo "ERROR: could not safely determine migration status. Aborting startup."
    exit 1
  fi
else
  echo "Migrations skipped: $MIGRATIONS_DIR not found."
fi

if [ "$RUN_MIGRATE_DEPLOY" -eq 1 ]; then
  echo "Running prisma migrate deploy..."
  if ! run_as_app "$PRISMA_CMD" migrate deploy --schema "$PRISMA_SCHEMA"; then
    echo "ERROR: prisma migrate deploy failed. Aborting startup."
    exit 1
  fi
  echo "Migrations applied successfully."
fi

SEED_FILE="./dist/prisma/seed.js"
SEED_ON_START="${SEED_ON_START:-true}"
SEED_FORCE="${SEED_FORCE:-false}"

if [ "$SEED_ON_START" = "true" ]; then
  if [ -f "$SEED_FILE" ]; then
    if [ "$SEED_FORCE" = "true" ]; then
      echo "SEED_FORCE=true. Running application seed pipeline with --force..."
      if ! run_as_app node "$SEED_FILE" deploy --force; then
        echo "ERROR: seed pipeline failed in force mode. Aborting startup."
        exit 1
      fi
    else
      echo "Checking pending seed modules..."
      set +e
      SEED_CHECK_OUTPUT="$(run_as_app node "$SEED_FILE" check 2>&1)"
      SEED_CHECK_EXIT=$?
      set -e

      echo "$SEED_CHECK_OUTPUT"
      if [ "$SEED_CHECK_EXIT" -ne 0 ]; then
        echo "ERROR: seed check failed. Aborting startup."
        exit 1
      fi

      if echo "$SEED_CHECK_OUTPUT" | grep -q "SEED_STATUS=PENDING"; then
        echo "Pending seeds detected. Running application seed pipeline (deploy mode)..."
        if ! run_as_app node "$SEED_FILE" deploy; then
          echo "ERROR: seed pipeline failed. Aborting startup."
          exit 1
        fi
      else
        echo "Seed pipeline skipped: no pending seed modules."
      fi
    fi
  else
    echo "Seed disabled: $SEED_FILE not found."
  fi
else
  echo "Seed skipped: SEED_ON_START=false"
fi

echo "Starting NestJS application..."
if [ -n "$RUN_AS_APP" ]; then
  exec su-exec nestjs:nodejs node dist/main.js
fi
exec node dist/main.js
