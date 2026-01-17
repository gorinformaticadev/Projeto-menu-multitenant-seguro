# =========================
# Builder
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar apenas os arquivos do app frontend
COPY package.json package-lock.json ./

# Instalar dependências com lockfile
RUN npm ci

# Copiar código-fonte
COPY . .

# Build Next.js (standalone)
RUN npm run build

# =========================
# Production
# =========================
FROM node:20-alpine AS production

# Criar usuário não-root
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

WORKDIR /app

# Copiar build standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=5000
ENV HOSTNAME=0.0.0.0

# Usuário não-root
USER nextjs

# Expor porta correta
EXPOSE 5000

# Iniciar Next.js
CMD ["node", "server.js"]
