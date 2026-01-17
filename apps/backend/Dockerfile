# =========================
# Base
# =========================
FROM node:20-alpine AS base
WORKDIR /app

# =========================
# Builder
# =========================
FROM base AS builder

# Set dummy DATABASE_URL for Prisma generate to work
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

# RUN npx prisma generate
RUN npm run build

# =========================
# Production dependencies
# =========================
FROM base AS prod-deps

COPY package*.json ./

# ⚠️ IMPORTANTE:
# npm ci NÃO funciona corretamente com workspaces aqui
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund

# =========================
# Runtime
# =========================
FROM base AS runner

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node dist/main.js"]
