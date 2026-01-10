# Dockerfile para Frontend - Corrigido
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache openssl

# Copiar package files
COPY apps/frontend/package*.json ./

# Instalar dependências
RUN npm ci && npm cache clean --force

# Copiar código fonte
COPY apps/frontend/. .

# Build da aplicação
RUN npm run build

# Etapa de produção
FROM node:18-alpine AS production

WORKDIR /app

# Instalar openssl
RUN apk add --no-cache openssl

# Copiar package files
COPY apps/frontend/package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar build do builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Expor porta
EXPOSE 5000

# Comando de inicialização
CMD ["npm", "start"]