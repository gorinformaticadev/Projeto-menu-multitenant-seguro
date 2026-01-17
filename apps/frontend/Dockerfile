# =========================
# Base
# =========================
FROM node:20-alpine AS base
WORKDIR /app

# =========================
# Builder
# =========================
FROM base AS builder

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
RUN npm install --workspaces --include-workspace-root --frozen-lockfile

COPY . .
RUN npm run build --workspace=frontend

# =========================
# Runner
# =========================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./.next/static

USER nextjs

EXPOSE 4000

ENV PORT=4000

CMD ["node", "server.js"]
