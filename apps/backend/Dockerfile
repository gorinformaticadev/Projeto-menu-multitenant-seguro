# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS builder
RUN apk add --no-cache libc6-compat

# Copia os manifestos do workspace para cache de camadas
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json

# Instala todas as dependências (incluindo devDeps para build)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --filter backend... --frozen-lockfile

# Copia o código fonte e gera os artefatos
COPY apps/backend apps/backend
# Gera o cliente Prisma
RUN pnpm --filter backend exec prisma generate
# Build do NestJS
RUN pnpm --filter backend build
# Compila o seed.ts para dist/prisma/seed.js
RUN pnpm --filter backend exec tsc prisma/seed.ts --outDir dist/prisma --skipLibCheck --module commonjs --target ES2021 --esModuleInterop

# Prepara as dependências de produção de forma robusta
# Em vez de pnpm deploy, vamos usar o node_modules instalado e remover o que não for necessário ou garantir que o runner tenha acesso
RUN rm -rf node_modules && pnpm install --filter backend... --prod --frozen-lockfile

FROM node:20-alpine AS runner
# O WORKDIR será /app para manter a estrutura do workspace que o NestJS espera no dist
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache curl postgresql-client
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copia os node_modules do root (workspace) e do app
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/docker-entrypoint.sh ./apps/backend/docker-entrypoint.sh

# Sanity check para garantir que o NestJS consegue carregar
RUN node -e "require('@nestjs/core'); console.log('nestjs ok')"

RUN chmod +x ./apps/backend/docker-entrypoint.sh
RUN mkdir -p /app/uploads /app/backups && chown -R nestjs:nodejs /app/uploads /app/backups

USER nestjs
EXPOSE 4000

# Define o WORKDIR para onde o entrypoint espera estar
WORKDIR /app/apps/backend
CMD ["./docker-entrypoint.sh"]
