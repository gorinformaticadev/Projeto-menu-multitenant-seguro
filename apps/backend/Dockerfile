# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS builder
RUN apk add --no-cache libc6-compat

# Copia manifestos do workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json

# Instala todas as dependências (necessário para o build)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --filter backend... --frozen-lockfile

# Copia código fonte e gera os artefatos
COPY apps/backend apps/backend
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build
RUN pnpm --filter backend exec tsc prisma/seed.ts --outDir apps/backend/dist/prisma --skipLibCheck --module commonjs --target ES2021 --esModuleInterop

# Prepara dependências de produção
RUN rm -rf node_modules && pnpm install --filter backend... --prod --frozen-lockfile

FROM node:20-alpine AS runner
# Vamos usar /app/apps/backend como WORKDIR principal para simplificar
WORKDIR /app/apps/backend
ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache curl postgresql-client
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copia as dependências do workspace para o local onde o Node as encontrará
# O segredo é copiar o node_modules do root para o root do runner
COPY --from=builder --chown=nestjs:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh

# Garante permissões
RUN chmod +x ./docker-entrypoint.sh
RUN mkdir -p /app/apps/backend/uploads /app/apps/backend/backups && chown -R nestjs:nodejs /app/apps/backend

USER nestjs
EXPOSE 4000

# O entrypoint agora rodará em /app/apps/backend
CMD ["./docker-entrypoint.sh"]
