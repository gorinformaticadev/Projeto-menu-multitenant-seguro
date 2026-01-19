# Multi-stage build for Next.js frontend with standalone output
FROM node:20-alpine AS builder

WORKDIR /app

# Install system deps
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./

# Use lockfile if present
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Build application
RUN npm run build

FROM node:20-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Copy standalone build from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

ENV NODE_ENV=production
ENV PORT=5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

EXPOSE 5000

CMD ["node", "server.js"]