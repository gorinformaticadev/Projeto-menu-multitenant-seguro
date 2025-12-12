# 🛠️ Comandos Úteis

Este documento contém comandos úteis para desenvolvimento e manutenção do sistema.

## 📦 Instalação

### Instalação Completa (Recomendado)

```bash
# Instalar dependências de backend e frontend
npm run install:all

# Ou instalar separadamente
npm run install:backend
npm run install:frontend
```

### Setup Completo do Projeto

```bash
# Instala tudo, gera Prisma Client, executa migrations e seed
npm run setup
```

## 🚀 Desenvolvimento

### Executar Backend e Frontend Simultaneamente

```bash
# Requer o pacote 'concurrently' instalado na raiz
npm run dev
```

### Executar Separadamente

```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 🗄️ Banco de Dados (Prisma)

### Gerar Prisma Client

```bash
cd backend
npm run prisma:generate
```

### Criar e Executar Migrations

```bash
cd backend
npm run prisma:migrate

# Ou com nome específico
npx prisma migrate dev --name nome_da_migration
```

### Resetar Banco de Dados

```bash
cd backend
npx prisma migrate reset
# Isso vai:
# 1. Dropar o banco
# 2. Criar novamente
# 3. Executar todas as migrations
# 4. Executar o seed (se configurado)
```

### Executar Seed Manualmente

```bash
cd backend
npx ts-node prisma/seed.ts
```

### Abrir Prisma Studio (Interface Visual)

```bash
cd backend
npx prisma studio
# Abre em http://localhost:5555
```

### Ver Status das Migrations

```bash
cd backend
npx prisma migrate status
```

### Criar Migration sem Executar

```bash
cd backend
npx prisma migrate dev --create-only --name nome_da_migration
```

## 🏗️ Build para Produção

### Build Completo

```bash
npm run build
```

### Build Separado

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### Executar Build de Produção

```bash
# Backend
cd backend
npm run start:prod

# Frontend
cd frontend
npm start
```

## 🧪 Testes (A Implementar)

```bash
# Backend - Testes unitários
cd backend
npm run test

# Backend - Testes e2e
cd backend
npm run test:e2e

# Backend - Coverage
cd backend
npm run test:cov

# Frontend - Testes
cd frontend
npm run test
```

## 🔍 Linting e Formatação

```bash
# Backend - Lint
cd backend
npm run lint

# Frontend - Lint
cd frontend
npm run lint
```

## 🐛 Debug

### Backend com Debug

```bash
cd backend
npm run start:debug
# Conecte o debugger na porta 9229
```

### Ver Logs do Backend

```bash
cd backend
npm run start:dev
# Logs aparecem no terminal
```

## 🗑️ Limpeza

### Limpar node_modules

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Limpar Build

```bash
# Backend
cd backend
rm -rf dist

# Frontend
cd frontend
rm -rf .next
```

### Limpar Tudo

```bash
# Backend
cd backend
rm -rf node_modules dist package-lock.json

# Frontend
cd frontend
rm -rf node_modules .next package-lock.json
```

## 🔐 Segurança

### Gerar Nova Secret para JWT

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64
```

### Verificar Vulnerabilidades

```bash
# Backend
cd backend
npm audit

# Frontend
cd frontend
npm audit
```

### Corrigir Vulnerabilidades

```bash
# Backend
cd backend
npm audit fix

# Frontend
cd frontend
npm audit fix
```

## 📊 Análise de Código

### Ver Tamanho do Bundle (Frontend)

```bash
cd frontend
npm run build
# Analise o output do build
```

### Analisar Dependências

```bash
# Backend
cd backend
npm list --depth=0

# Frontend
cd frontend
npm list --depth=0
```

## 🌐 Variáveis de Ambiente

### Backend (.env)

```bash
cd backend
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### Frontend (.env.local)

```bash
cd frontend
cp .env.local.example .env.local
# Edite o arquivo .env.local se necessário
```

## 🐳 Docker

### Desenvolvimento

```bash
# Construir e iniciar todos os serviços (desenvolvimento)
docker-compose -f docker-compose.dev.yml up --build

# Executar em background (desenvolvimento)
docker-compose -f docker-compose.dev.yml up --build -d

# Parar os serviços (desenvolvimento)
docker-compose -f docker-compose.dev.yml down
```

### Produção

```bash
# Construir e iniciar todos os serviços (produção)
docker-compose up --build

# Executar em background (produção)
docker-compose up --build -d

# Parar os serviços (produção)
docker-compose down
```

### Comandos Úteis

```bash
# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f backend

# Acessar o shell do container Backend
docker-compose exec backend sh

# Acessar o shell do container Frontend
docker-compose exec frontend sh

# Executar migrações do banco de dados (desenvolvimento)
docker-compose -f docker-compose.dev.yml exec backend npm run prisma:migrate

# Executar migrações do banco de dados (produção)
docker-compose exec backend npm run prisma:migrate

# Popular o banco com dados iniciais (desenvolvimento)
docker-compose -f docker-compose.dev.yml exec backend npx ts-node prisma/seed.ts

# Popular o banco com dados iniciais (produção)
docker-compose exec backend npx ts-node prisma/seed.ts
```

## 📝 Git

### Commit Convencional

```bash
# Feat: Nova funcionalidade
git commit -m "feat: adiciona endpoint de usuários"

# Fix: Correção de bug
git commit -m "fix: corrige validação de email"

# Docs: Documentação
git commit -m "docs: atualiza README"

# Style: Formatação
git commit -m "style: formata código com prettier"

# Refactor: Refatoração
git commit -m "refactor: melhora estrutura do AuthService"

# Test: Testes
git commit -m "test: adiciona testes para TenantService"

# Chore: Manutenção
git commit -m "chore: atualiza dependências"
```

## 🔄 Atualizar Dependências

### Verificar Atualizações Disponíveis

```bash
# Backend
cd backend
npm outdated

# Frontend
cd frontend
npm outdated
```

### Atualizar Dependências

```bash
# Backend
cd backend
npm update

# Frontend
cd frontend
npm update
```

### Atualizar para Versões Maiores

```bash
# Instalar npm-check-updates
npm install -g npm-check-updates

# Backend
cd backend
ncu -u
npm install

# Frontend
cd frontend
ncu -u
npm install
```

## 🚨 Troubleshooting

### Erro: Port already in use

```bash
# Windows - Matar processo na porta 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac - Matar processo na porta 3001
lsof -ti:3001 | xargs kill -9
```

### Erro: Cannot find module

```bash
# Reinstalar dependências
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Erro: Prisma Client not generated

```bash
cd backend
npm run prisma:generate
```

### Erro: Database connection failed

```bash
# Verificar se PostgreSQL está rodando
# Windows: Serviços > PostgreSQL
# Linux/Mac: sudo service postgresql status

# Verificar .env
cd backend
cat .env
# Confirme que DATABASE_URL está correto
```

### Erro: CORS

```bash
# Verificar FRONTEND_URL no backend/.env
# Deve corresponder à URL do frontend
```

## 📚 Documentação

### Gerar Documentação da API (Swagger)

```bash
# A implementar
cd backend
npm run docs
```

### Ver Documentação do Prisma

```bash
cd backend
npx prisma studio
```

## 🎯 Atalhos Úteis

```bash
# Alias para comandos frequentes (adicione ao .bashrc ou .zshrc)
alias dev-backend="cd backend && npm run start:dev"
alias dev-frontend="cd frontend && npm run dev"
alias prisma-studio="cd backend && npx prisma studio"
alias prisma-reset="cd backend && npx prisma migrate reset"
```

## 📊 Monitoramento

### Ver Uso de Memória (Node.js)

```bash
# Backend
cd backend
node --inspect npm run start:dev
# Abra chrome://inspect no Chrome
```

### Ver Logs em Tempo Real

```bash
# Backend
cd backend
npm run start:dev | tee logs.txt
```

## 🔧 Configuração do Editor

### VSCode - Extensões Recomendadas

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### VSCode - Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

