# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS builder
RUN apk add --no-cache libc6-compat

# Copia manifestos
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json

# Instala dependências
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --filter backend... --frozen-lockfile

# Copia código e gera build
COPY apps/backend apps/backend
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build
RUN pnpm --filter backend exec tsc prisma/seed.ts --outDir dist/prisma --skipLibCheck --module commonjs --target ES2021 --esModuleInterop

# Limpa e instala apenas produção
RUN rm -rf node_modules && pnpm install --filter backend... --prod --frozen-lockfile

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache curl postgresql-client
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copia dependências e artefatos mantendo a estrutura do workspace
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/docker-entrypoint.sh ./apps/backend/docker-entrypoint.sh

# Garante permissões
RUN chmod +x ./apps/backend/docker-entrypoint.sh
RUN mkdir -p /app/uploads /app/backups && chown -R nestjs:nodejs /app/uploads /app/backups

USER nestjs
EXPOSE 4000

WORKDIR /app/apps/backend
CMD ["./docker-entrypoint.sh"]
