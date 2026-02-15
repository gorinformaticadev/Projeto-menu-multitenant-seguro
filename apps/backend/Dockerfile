FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# -------------------------
# Builder (build completo)
# -------------------------
FROM base AS builder
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build
RUN npx tsc apps/backend/prisma/seed.ts --outDir apps/backend/dist/prisma --skipLibCheck --module commonjs --target ES2021 --esModuleInterop

# -------------------------
# prod-deps (somente backend)
# -------------------------
FROM base AS prod-deps
WORKDIR /app

# Copia arquivos do backend como projeto standalone
COPY apps/backend/package.json ./package.json
COPY apps/backend/prisma ./prisma
COPY .npmrc* ./

# Instala deps de produção (sem workspace)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --no-frozen-lockfile

# Gera prisma client (garante que entra em node_modules)
RUN pnpm prisma generate

# -------------------------
# Runner
# -------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache curl postgresql-client

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./prisma

# Aqui é /app/node_modules (não apps/backend/node_modules)
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

RUN chmod +x ./docker-entrypoint.sh

# CORREÇÃO: Criar diretórios com permissões corretas ANTES de trocar para usuário nestjs
# O código tenta criar /app/src/modules, mas o correto seria /app/modules (fora de src)
# Criamos ambos para garantir compatibilidade
RUN mkdir -p /app/uploads/logos /app/backups /app/modules /app/src/modules && \
    chown -R nestjs:nodejs /app/uploads /app/backups /app/modules /app/src

USER nestjs

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
