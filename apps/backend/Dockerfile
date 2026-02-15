FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Builder stage
FROM base AS builder
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

# Production Dependencies Stage
# Cria um stage intermediário para instalar dependências de produção de forma limpa.
# Isso contorna problemas do 'pnpm deploy' com workspaces no pnpm v10.
FROM base AS prod-deps
WORKDIR /app

# Copia apenas o package.json do backend. 
# Tratamos o backend como um projeto standalone aqui para evitar complexidade de workspace.
COPY apps/backend/package.json ./

# Instala apenas dependências de produção.
# O --ignore-scripts é opcional, mas seguro se não houver scripts de postinstall críticos (exceto prisma).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod

# Copia o schema do Prisma para gerar o client
COPY apps/backend/prisma ./prisma

# Gera o Prisma Client explicitamente neste stage para que ele seja incluído em node_modules
# Como 'prisma' está nas 'dependencies' do package.json, o binário estará disponível.
RUN pnpm prisma generate

# Runner stage - production only
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Install runtime dependencies (e.g. for prisma/pg_isready)
RUN apk add --no-cache curl postgresql-client

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built artifacts from builder
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./prisma

# Copy production node_modules from prod-deps
# Isso garante que todas as dependências listadas em 'dependencies' (incluindo @nestjs/*) estejam presentes.
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

RUN chmod +x ./docker-entrypoint.sh

USER nestjs

EXPOSE 4000

CMD ["./docker-entrypoint.sh"]
