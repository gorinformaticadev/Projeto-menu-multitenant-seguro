# Dockerfile para Frontend - Corrigido
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache openssl

# Copiar package files
COPY apps/frontend/package*.json ./

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY apps/frontend/. .

# Build da aplicação
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# Etapa de produção
FROM node:20-alpine AS production

WORKDIR /app

# Instalar openssl
RUN apk add --no-cache openssl

# Copiar package files
COPY apps/frontend/package*.json ./

# Instalar apenas dependências de produção
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copiar build do builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Expor porta
EXPOSE 5000

# Comando de inicialização
CMD ["npm", "start"]