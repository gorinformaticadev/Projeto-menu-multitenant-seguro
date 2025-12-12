# Etapa de construção
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package files e instalar dependências
COPY frontend/package*.json ./
RUN npm ci

# Copiar código fonte
COPY frontend/. .

# Construir aplicação
RUN npm run build

# Etapa de produção
FROM node:18-alpine AS production

WORKDIR /app

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copiar dependências de produção
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copiar arquivos essenciais
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/next-env.d.ts ./

USER nextjs

EXPOSE 5000

CMD ["npm", "start"]