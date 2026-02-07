# Backend multi-stage build - optimized for pnpm monorepo
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Builder stage
FROM base AS builder
WORKDIR /app
# Copy monorepo configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy source code (needed for workspace links)
COPY . .

# Install dependencies using lockfile
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm --filter backend prisma:generate

# Build backend
RUN pnpm --filter backend build
ENV CI=true
RUN pnpm prune --prod

# Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy dependencies and build artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./package.json
COPY --from=builder /app/apps/backend/prisma ./prisma

# Copy entrypoint script
COPY --from=builder /app/apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nestjs

EXPOSE 4000
CMD ["/app/docker-entrypoint.sh"]