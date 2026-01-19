# Backend multi-stage build - safer npm usage and entrypoint for migrations
FROM node:20-alpine AS base
WORKDIR /app

# Builder
FROM base AS builder

# copy only package files first for caching
COPY package*.json ./
# ensure lockfile usage if present
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps --no-audit --no-fund; else npm install --legacy-peer-deps --no-audit --no-fund; fi

COPY . .

RUN npm run build

# Production deps
FROM base AS prod-deps
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund; else npm install --omit=dev --legacy-peer-deps --no-audit --no-fund; fi

# Runtime
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000

# copy node_modules and build artifacts
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# copy entrypoint
COPY apps/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]