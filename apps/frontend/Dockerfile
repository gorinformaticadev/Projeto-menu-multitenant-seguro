# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --filter frontend... --frozen-lockfile
COPY apps/frontend apps/frontend
ARG NEXT_PUBLIC_API_URL=/api
ARG APP_VERSION=0.0.0
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true
RUN pnpm --filter frontend build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000
ENV HOSTNAME=0.0.0.0
ARG APP_VERSION=0.0.0
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME
RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar o standalone completo
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./

# Copiar os arquivos estáticos e públicos para o local correto
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./__frontend_static__
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./__frontend_public__
RUN set -eux; \
    if [ -f /app/apps/frontend/server.js ]; then target=/app/apps/frontend; \
    elif [ -f /app/server.js ]; then target=/app; \
    else echo 'ERRO: entrypoint standalone do frontend nao encontrado no artefato Docker.' >&2; exit 1; fi; \
    if [ -d /app/__frontend_public__ ]; then mkdir -p "$target/public"; cp -a /app/__frontend_public__/. "$target/public/"; fi; \
    if [ -d /app/__frontend_static__ ]; then mkdir -p "$target/.next/static"; cp -a /app/__frontend_static__/. "$target/.next/static/"; fi; \
    rm -rf /app/__frontend_public__ /app/__frontend_static__

USER nextjs
EXPOSE 5000

# O server.js está em apps/frontend/server.js dentro do standalone
# Passar PORT e HOSTNAME explicitamente
CMD ["sh", "-c", "if [ -f apps/frontend/server.js ]; then entry=apps/frontend/server.js; elif [ -f server.js ]; then entry=server.js; else echo 'ERRO: entrypoint standalone do frontend nao encontrado no container.' >&2; exit 1; fi; exec env PORT=5000 HOSTNAME=0.0.0.0 node \"$entry\""]
