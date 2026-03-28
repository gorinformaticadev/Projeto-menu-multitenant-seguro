# Comandos Uteis

Comandos para desenvolvimento e manutencao do sistema Pluggor.

## Instalacao

### Instalacao Completa (Recomendado)
```bash
pnpm install:all
```

### Setup Completo do Projeto
```bash
# Instala tudo, gera Prisma Client, executa migrations e seed
pnpm install:all
```

## Desenvolvimento

### Executar Backend e Frontend
```bash
# Backend
pnpm dev:backend

# Frontend (em outro terminal)
pnpm dev:frontend
```

### Executar Separadamente
```bash
# Terminal 1 - Backend
pnpm --filter backend start:dev

# Terminal 2 - Frontend
pnpm --filter frontend dev
```

## Banco de Dados (Prisma)

### Gerar Prisma Client
```bash
pnpm --filter backend exec prisma generate
```

### Criar e Executar Migrations
```bash
pnpm --filter backend exec prisma migrate dev --name nome_da_migration
```

### Aplicar Migrations em Producao
```bash
pnpm --filter backend exec prisma migrate deploy
```

### Ver Status das Migrations
```bash
pnpm --filter backend exec prisma migrate status
```

### Resetar Banco de Dados
```bash
pnpm --filter backend exec prisma migrate reset
```

### Abrir Prisma Studio (Interface Visual)
```bash
pnpm --filter backend exec prisma studio
# Abre em http://localhost:5555
```

### Executar Seed Manualmente
```bash
pnpm --filter backend exec prisma db seed
```

## Build para Producao

### Build Completo
```bash
pnpm build:all
```

### Build Separado
```bash
# Backend
pnpm --filter backend build

# Frontend
pnpm --filter frontend build
```

## Testes

```bash
# Todos os testes
pnpm test:all

# Backend - Testes unitarios
pnpm --filter backend test

# Backend - Testes e2e
pnpm --filter backend test:e2e

# Backend - Coverage
pnpm --filter backend test:cov
```

## Linting

```bash
# Backend
pnpm --filter backend lint

# Frontend
pnpm --filter frontend lint

# Verificacao de cores hardcoded (theming)
pnpm check:theming
```

## CI Local

```bash
pnpm ci:local
```

Executa: install, build backend, test backend, security guardrails, security regression, lint, theming check, build frontend, lint frontend, scripts check, smoke tests.

## Seguranca

```bash
# Security guardrails
pnpm --filter backend run security:guardrails

# Security regression tests
pnpm --filter backend run test:security-regression
```

## Versionamento

```bash
# Gerar release (bump version + changelog)
pnpm release

# Release + push tags
pnpm versao
```

## Docker

### Desenvolvimento
```bash
docker compose -f docker-compose.dev.yml up --build
docker compose -f docker-compose.dev.yml up --build -d   # background
docker compose -f docker-compose.dev.yml down            # parar
```

### Producao
```bash
docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d
docker compose --env-file install/.env.production -f docker-compose.prod.yml down
```

### Logs
```bash
docker compose logs -f                  # todos
docker compose logs -f backend          # especifico
```

### Executar comandos em containers
```bash
docker compose exec backend pnpm exec prisma migrate deploy --schema prisma/schema.prisma
docker compose exec backend pnpm exec prisma db seed
```

### Stack de producao (manual)
```bash
cd /caminho/Pluggor

# Subir
docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d

# Parar
docker compose --env-file install/.env.production -f docker-compose.prod.yml down

# Build (após alterar backend/frontend)
docker compose --env-file install/.env.production -f docker-compose.prod.yml build
docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d
```

## Limpeza

```bash
# Limpar todos os node_modules, dist e .next
pnpm clean
```

## Git

```bash
# Commit convencional
git commit -m "feat: adiciona endpoint de usuarios"
git commit -m "fix: corrige validacao de email"
git commit -m "docs: atualiza README"
git commit -m "refactor: melhora estrutura do AuthService"
git commit -m "test: adiciona testes para TenantService"
git commit -m "chore: atualiza dependencias"
```

## Variaveis de Ambiente

### Backend (.env)
```bash
cp .env.example .env
# Edite o arquivo .env com suas configuracoes
```

## Troubleshooting

### Erro: Port already in use
```bash
# Linux/Mac
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

### Erro: Prisma Client not generated
```bash
pnpm --filter backend exec prisma generate
```

### Erro: Database connection failed
Verifique se PostgreSQL esta rodando e confirme o DATABASE_URL no `.env`.

## Editor

### VSCode - Extensoes Recomendadas
- dbaeumer.vscode-eslint
- esbenp.prettier-vscode
- prisma.prisma
- bradlc.vscode-tailwindcss
- ms-vscode.vscode-typescript-next

### Matar processos node
```bash
taskkill /F /IM node.exe 
```