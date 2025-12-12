# Etapa de construção
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache openssl

# Copiar package files e instalar dependências
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar código fonte e gerar artefatos
COPY backend/. .
RUN npm run build

# Etapa de produção
FROM node:18-alpine AS production

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache openssl

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Instalar prisma client
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma

# Copiar dependências de produção
COPY --from=builder /app/node_modules /app/node_modules

# Copiar build e prisma schema
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/prisma /app/prisma

# Copiar arquivos estáticos
COPY --from=builder /app/uploads /app/uploads

# Criar diretórios necessários
RUN mkdir -p /app/uploads/logos

# Alterar permissões
RUN chown -R nextjs:nodejs /app/uploads
RUN chown -R nextjs:nodejs /app/dist

USER nextjs

EXPOSE 4000

CMD ["node", "dist/main"]