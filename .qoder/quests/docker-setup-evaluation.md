# Avaliação e Implementação do Setup Docker para Sistema Multitenant Seguro

## Visão Geral

Este documento apresenta a avaliação do projeto quanto à instalação via Docker, CI/CD Pipeline, e propõe otimizações e configurações necessárias para implantação contêinerizada do sistema multitenant seguro.

## Estado Atual do Projeto

### Estrutura Geral
O projeto segue uma arquitetura monorepo com dois diretórios principais:
- `backend/`: Aplicação NestJS com Prisma ORM
- `frontend/`: Aplicação Next.js

### Tecnologias Principais
- **Backend**: NestJS 10+, PostgreSQL, Prisma ORM
- **Frontend**: Next.js 14, React 18
- **Autenticação**: JWT com Bcrypt
- **Segurança**: RBAC, 2FA, CORS configurado

### Configurações de Ambiente
- Variáveis de ambiente separadas para backend e frontend
- Configurações de desenvolvimento já presentes
- Scripts de inicialização definidos

## Avaliação da Implantação com Docker

### Estado Atual do Suporte ao Docker
Após análise do código-base, constata-se que:

1. **Não há arquivos Dockerfile** nos diretórios backend ou frontend
2. **Não há docker-compose.yml** na raiz do projeto
3. **Seção sobre Docker em COMANDOS_UTEIS.md** indica comandos planejados mas não implementados:
   ```bash
   # Docker (A Implementar)
   docker-compose build
   docker-compose up
   ```

### Limitações Identificadas
1. Ausência de imagens Docker otimizadas para produção
2. Nenhum pipeline de CI/CD configurado
3. Sem definições de ambientes específicos para contêineres
4. Sem estratégias de health checks
5. Sem definições de recursos (CPU/Memória) para ambientes de produção

## Proposta de Configuração Docker

### Dockerfile para Backend

```dockerfile
# Etapa de construção
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package files e instalar dependências
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar código fonte e gerar artefatos
COPY backend/. .
RUN npm run build

# Etapa de produção
FROM node:18-alpine AS production

WORKDIR /app

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
```

### Dockerfile para Frontend

```dockerfile
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
```

### Docker Compose para Desenvolvimento

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: multitenant-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: multitenant_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile.dev
    container_name: multitenant-backend
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/multitenant_db?schema=public
      - JWT_SECRET=supersecretkey_dev_12345678901234567890123456789012
      - FRONTEND_URL=http://localhost:5000
      - NODE_ENV=development
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      - db
    networks:
      - app-network

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile.dev
    container_name: multitenant-frontend
    ports:
      - "5000:5000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:4000
      - NODE_ENV=development
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
```

### Docker Compose para Produção

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: multitenant-db-prod
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build: ./backend
    container_name: multitenant-backend-prod
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public&sslmode=require
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
      - NODE_ENV=production
      - PORT=4000
    volumes:
      - ./backend/uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    container_name: multitenant-frontend-prod
    ports:
      - "5000:5000"
    environment:
      - NEXT_PUBLIC_API_URL=${API_URL}
      - NODE_ENV=production
    depends_on:
      - backend
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
```

### Dockerfile.dev para Backend (Desenvolvimento)

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache bash

# Copiar package files
COPY backend/package*.json ./

# Instalar todas as dependências (incluindo dev)
RUN npm ci

# Copiar prisma schema para gerar client
COPY backend/prisma ./prisma

# Gerar Prisma Client
RUN npm run prisma:generate

# Criar diretórios necessários
RUN mkdir -p uploads/logos

# Expôr porta
EXPOSE 4000

# Comando padrão para desenvolvimento
CMD ["npm", "run", "start:dev"]
```

### Dockerfile.dev para Frontend (Desenvolvimento)

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar package files
COPY frontend/package*.json ./

# Instalar dependências
RUN npm ci

# Expôr porta
EXPOSE 5000

# Comando padrão para desenvolvimento
CMD ["npm", "run", "dev"]
```

## Pipeline CI/CD

### GitHub Actions Workflow

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install backend dependencies
      run: |
        cd backend
        npm ci

    - name: Install frontend dependencies
      run: |
        cd frontend
        npm ci

    - name: Generate Prisma Client
      run: |
        cd backend
        npm run prisma:generate

    - name: Run backend lint
      run: |
        cd backend
        npm run lint

    - name: Run frontend lint
      run: |
        cd frontend
        npm run lint

    - name: Run security audit
      run: |
        cd backend
        npm audit --audit-level=moderate || true
        cd ../frontend
        npm audit --audit-level=moderate || true

    - name: Run tests (when implemented)
      run: |
        echo "Tests will be added when test suite is implemented"

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - uses: actions/checkout@v3

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2

    - name: Login to DockerHub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}

    - name: Build and push backend
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        push: true
        tags: ${{ secrets.DOCKER_USERNAME }}/multitenant-backend:latest

    - name: Build and push frontend
      uses: docker/build-push-action@v4
      with:
        context: ./frontend
        push: true
        tags: ${{ secrets.DOCKER_USERNAME }}/multitenant-frontend:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - name: Deploy to production
      run: |
        echo "Deployment steps would go here"
        echo "This would typically involve:"
        echo "1. Connecting to production server"
        echo "2. Pulling latest images"
        echo "3. Running docker-compose up -d"
```

## Otimizações Propostas

### 1. Estratégias de Build
- Multi-stage builds para reduzir tamanho das imagens
- Uso de Alpine Linux para imagens menores
- Cache de dependências para builds mais rápidos

### 2. Segurança
- Usuários não-root nas imagens de produção
- Health checks para monitoramento
- Configurações de recursos (CPU/Memória) para ambientes de produção

### 3. Configuração de Ambientes
- Arquivos `.env.production` e `.env.development` distintos
- Variáveis de ambiente para todos os serviços sensíveis
- Secrets management através de orquestrador (Docker Swarm, Kubernetes)

### 4. Monitoramento e Logging
- Logs centralizados através do Docker
- Health checks para todos os serviços
- Métricas de desempenho

## Documentação de Instalação com Docker

### Pré-requisitos
- Docker Engine 20.10+
- Docker Compose 1.29+

### Instalação Rápida

1. **Clone o repositório**
   ```bash
   git clone <repo-url>
   cd projeto-menu-multitenant-seguro
   ```

2. **Configure variáveis de ambiente**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Edite as variáveis conforme necessário
   
   # Frontend
   cp frontend/.env.local.example frontend/.env.local
   # Edite as variáveis conforme necessário
   ```

3. **Inicie os serviços**
   ```bash
   # Desenvolvimento
   docker-compose -f docker-compose.dev.yml up --build
   
   # Produção
   docker-compose up --build
   ```

4. **Execute migrações do banco de dados**
   ```bash
   # Em um novo terminal
   docker-compose exec backend npm run prisma:migrate
   docker-compose exec backend npx ts-node prisma/seed.ts
   ```

5. **Acesse as aplicações**
   - Frontend: http://localhost:5000
   - Backend API: http://localhost:4000
   - Banco de dados: localhost:5432

### Comandos Úteis

```bash
# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down

# Reconstruir serviços
docker-compose up --build

# Executar comandos no container
docker-compose exec backend sh
docker-compose exec frontend sh

# Ver status dos serviços
docker-compose ps
```

## Considerações de Segurança para Docker

### 1. Imagens
- Usar imagens oficiais e verificadas
- Manter imagens atualizadas
- Evitar imagens desnecessariamente grandes

### 2. Rede
- Isolar containers em redes dedicadas
- Não expor portas desnecessariamente
- Usar network segmentation

### 3. Volumes
- Restringir permissões de escrita
- Backup regular de dados persistentes
- Criptografia em repouso quando necessário

### 4. Runtime
- Usar políticas de reinício adequadas
- Configurar limites de recursos
- Monitorar consumo de recursos

## Próximos Passos Recomendados

### Fase 1: Implementação Básica
1. Criar Dockerfiles para backend e frontend
2. Criar docker-compose.yml para desenvolvimento
3. Atualizar documentação com instruções de instalação

### Fase 2: Pipeline CI/CD
1. Configurar GitHub Actions para testes
2. Implementar build automatizado de imagens
3. Configurar deploy automático para staging

### Fase 3: Otimizações Avançadas
1. Implementar health checks
2. Configurar limites de recursos
3. Adicionar monitoramento e logging
4. Implementar secrets management

### Fase 4: Ambientes Específicos
1. Criar configurações para staging
2. Implementar ambiente de produção
3. Configurar backup e restore automatizados

## Conclusão

A implementação do Docker no projeto trará diversos benefícios:
- Padronização do ambiente de desenvolvimento
- Facilidade de implantação
- Isolamento de dependências
- Escalabilidade horizontal
- Integração contínua mais eficiente

Com as configurações propostas, o projeto estará pronto para ser implantado em qualquer ambiente que suporte Docker, mantendo suas características de segurança e multitenancy.
