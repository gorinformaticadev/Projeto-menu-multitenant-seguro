# Dockerfile para Backend - Corrigido
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache openssl python3 make g++

# Copiar package files
COPY apps/backend/package*.json ./

# Instalar dependências
RUN npm ci --only=production && npm cache clean --force

# Copiar código fonte
COPY apps/backend/. .

# Build da aplicação
RUN npm run build

# Etapa de produção
FROM node:18-alpine AS production

WORKDIR /app

# Instalar openssl para JWT
RUN apk add --no-cache openssl

# Copiar package files
COPY apps/backend/package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar build do builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Criar diretório de uploads
RUN mkdir -p uploads

# Expor porta
EXPOSE 4000

# Comando de inicialização
CMD ["node", "dist/main.js"]