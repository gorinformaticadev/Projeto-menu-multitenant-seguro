# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --filter backend... --frozen-lockfile

FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/backend/node_modules /app/apps/backend/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/backend apps/backend
RUN pnpm --filter backend exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter backend build
# Compilar o seed para o diretório correto
WORKDIR /app/apps/backend
RUN pnpm exec tsc prisma/seed.ts --outDir dist/prisma --skipLibCheck --module commonjs --target ES2021 --esModuleInterop --resolveJsonModule
WORKDIR /app

FROM base AS prod-deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/backend/prisma apps/backend/prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --filter backend... --prod --frozen-lockfile
RUN pnpm --filter backend exec prisma generate --schema prisma/schema.prisma

FROM node:20-alpine AS runner
WORKDIR /app/apps/backend
ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache curl postgresql-client
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/apps/backend/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh
RUN mkdir -p /app/apps/backend/uploads /app/apps/backend/backups && chown -R nestjs:nodejs /app/apps/backend

USER nestjs
EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
