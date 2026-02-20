# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS builder
RUN apk add --no-cache libc6-compat

# Workspace manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/backend/prisma.config.ts apps/backend/prisma.config.ts
COPY apps/backend/prisma apps/backend/prisma

# Install all deps (including devDeps needed for build).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --filter backend... --frozen-lockfile

# Build backend artifacts.
COPY apps/backend apps/backend
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build
RUN pnpm --filter backend exec tsc prisma/seed.ts --outDir dist/prisma --skipLibCheck --module commonjs --target ES2021 --esModuleInterop

# Create a production-ready backend bundle using pnpm deploy.
# pnpm deploy --prod copies only production deps (no devDeps) to /opt/backend-prod.
RUN set -eu; \
  if pnpm --filter backend deploy --prod /opt/backend-prod; then \
    echo "pnpm deploy --prod succeeded"; \
  else \
    echo "pnpm deploy --prod failed; using fallback production install"; \
    rm -rf /opt/backend-prod /tmp/backend-fallback; \
    mkdir -p /tmp/backend-fallback/apps/backend /opt/backend-prod; \
    cp package.json pnpm-lock.yaml pnpm-workspace.yaml /tmp/backend-fallback/; \
    cp apps/backend/package.json /tmp/backend-fallback/apps/backend/package.json; \
    cp apps/backend/prisma.config.ts /tmp/backend-fallback/apps/backend/prisma.config.ts; \
    cp -R apps/backend/prisma /tmp/backend-fallback/apps/backend/prisma; \
    cd /tmp/backend-fallback; \
    pnpm install --filter backend... --prod --frozen-lockfile; \
    pnpm --filter backend exec prisma generate; \
    cp apps/backend/package.json /opt/backend-prod/package.json; \
    cp -R apps/backend/node_modules /opt/backend-prod/node_modules 2>/dev/null || \
    cp -R node_modules /opt/backend-prod/node_modules; \
    rm -rf /tmp/backend-fallback; \
  fi

FROM node:20-alpine AS runner
WORKDIR /app/apps/backend
ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache curl postgresql-client
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copia arquivos de produção
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./package.json
# Usa os node_modules de produção do pnpm deploy (sem devDeps)
COPY --from=builder --chown=nestjs:nodejs /opt/backend-prod/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh

# Runtime dependency sanity check (required by audit).
RUN node -e "require('@nestjs/core'); console.log('nestjs ok')"

RUN chmod +x ./docker-entrypoint.sh
RUN mkdir -p /app/uploads/logos /app/backups /app/modules /app/src/modules && chown -R nestjs:nodejs /app/uploads /app/backups /app/modules /app/src

USER nestjs
EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
