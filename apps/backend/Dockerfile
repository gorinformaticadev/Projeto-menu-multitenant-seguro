# Backend multi-stage build - optimized for production
FROM node:20-alpine AS base

# Builder stage
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

# Runner stage - production only
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Install curl for healthcheck and postgresql-client for entrypoint (pg_isready)
RUN apk add --no-cache curl postgresql-client

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy node_modules from builder (the entire monorepo node_modules)
COPY --from=builder /app/node_modules ./node_modules

# Copy build artifacts
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/package.json ./

# Copy entrypoint script
COPY --from=builder /app/apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nestjs

EXPOSE 4000

CMD ["/app/docker-entrypoint.sh"]
