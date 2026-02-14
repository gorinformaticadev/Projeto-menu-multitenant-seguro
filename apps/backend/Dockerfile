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

# Deploy stage - creates standalone package
# Fix for pnpm v10+ workspace deploy error
RUN echo "inject-workspace-packages=true" >> .npmrc && pnpm --filter=backend --prod deploy /app/pruned

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

# Copy pruned dependencies and built files
COPY --from=builder --chown=nestjs:nodejs /app/pruned/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/pruned/dist ./dist
# Prisma client is usually in node_modules, but schema/migrations might be needed
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/pruned/package.json ./package.json

# Copy entrypoint script explicitly from source or builder
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nestjs

EXPOSE 4000

CMD ["./docker-entrypoint.sh"]
