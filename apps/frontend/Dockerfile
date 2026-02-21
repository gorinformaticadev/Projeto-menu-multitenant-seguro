# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --filter frontend... --frozen-lockfile
COPY apps/frontend apps/frontend
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true
RUN pnpm --filter frontend build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar o standalone completo
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./

# Copiar os arquivos estáticos e públicos para o local correto
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

USER nextjs
EXPOSE 5000

# O server.js está em apps/frontend/server.js dentro do standalone
# Passar PORT e HOSTNAME explicitamente
CMD ["sh", "-c", "PORT=5000 HOSTNAME=0.0.0.0 node apps/frontend/server.js"]
