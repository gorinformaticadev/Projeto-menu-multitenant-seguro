# =========================
# Builder
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Copia apenas o necessário para instalar deps
COPY package.json ./

# Sem lockfile → npm install
RUN npm install

# Copia o restante do frontend
COPY . .

# Build do Next.js
RUN npm run build

# =========================
# Runtime
# =========================
FROM node:20-alpine AS runtime

# Usuário não-root
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

WORKDIR /app

# Copia standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Configurações
ENV NODE_ENV=production
ENV PORT=5000
ENV HOSTNAME=0.0.0.0

USER nextjs

EXPOSE 5000

CMD ["node", "server.js"]
