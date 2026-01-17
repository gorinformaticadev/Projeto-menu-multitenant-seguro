FROM node:20-alpine AS builder

WORKDIR /app

# Copia arquivos do monorepo
COPY package.json package-lock.json ./
COPY apps/frontend ./apps/frontend

# Instala dependências do workspace
RUN npm install --workspaces --include-workspace-root

WORKDIR /app/apps/frontend
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/apps/frontend/.next ./.next
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/package.json ./package.json

EXPOSE 4000
CMD ["npm", "start"]
