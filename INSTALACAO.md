# 🚀 Guia de Instalação Rápida (pnpm Workspace)

Este projeto utiliza **pnpm workspace**. Todas as dependências são gerenciadas na raiz.

## Pré-requisitos

- Node.js 20 ou superior
- PostgreSQL instalado e rodando
- **pnpm** instalado globalmente (`npm install -g pnpm`)

## Passo 1: Instalação e Configuração

1.  **Instalar dependências (na raiz)**
    ```bash
    pnpm install
    ```
    *Isso instala dependências do backend e frontend automaticamente.*

2.  **Configurar Variáveis de Ambiente**

    *Backend:*
    ```bash
    cp apps/backend/.env.example apps/backend/.env
    ```
    Edite `apps/backend/.env` com suas configurações do PostgreSQL.

    *Frontend:*
    ```bash
    cp apps/frontend/.env.local.example apps/frontend/.env.local
    ```

3.  **Configurar Banco de Dados**
    ```bash
    # Gerar Client Prisma
    pnpm --filter backend exec prisma generate

    # Executar Migrations
    pnpm --filter backend exec prisma generate

    # Popular banco com dados iniciais
    pnpm --filter backend exec ts-node prisma/seed.ts
    ```

    # Gerar Prisma Client 
npm run prisma:generate

# Criar banco de dados e executar migrations
npm run prisma:migrate

# Popular banco com dados iniciais (usuários de teste)
npx ts-node prisma/seed.ts

# Iniciar servidor backend
npm run start:dev
```


### Apagar banco de dados
1️⃣ Acessar o PostgreSQL

No PowerShell ou Prompt de Comando:
```bash
psql -U postgres
```
ou & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres
substitua o 18 pelo numeo do postgres


Digite a senha:

```bash
postgres123
```

2️⃣ Derrubar conexões ativas (OBRIGATÓRIO)

Postgres não apaga banco com conexão aberta.

```bash
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'multitenant_db';
```


(Altere o nome se for outro)

3️⃣ Apagar o banco
```bash
DROP DATABASE multitenant_db;
```


4️⃣ Recriar o banco
```bash
CREATE DATABASE multitenant_db
WITH OWNER = postgres
ENCODING = 'UTF8'
LC_COLLATE = 'Portuguese_Brazil.1252'
LC_CTYPE   = 'Portuguese_Brazil.1252'
TEMPLATE template0;
```

5️⃣ Sair

```bash
\q

## Passo 2: Rodar o Projeto

Você pode rodar os projetos diretamente da raiz:

```bash
# Iniciar Backend (Porta 4000)
pnpm run dev:backend

# Iniciar Frontend (Porta 5000)
pnpm run dev:frontend
```

## Passo 3: Acessar o Sistema

Abra seu navegador em `http://localhost:5000`

### Credenciais de Teste

#### SUPER_ADMIN (Acesso Total)
- **Email**: `admin@system.com`
- **Senha**: `eRR&KnFyuo&UI6d*`

#### ADMIN (Tenant)
- **Email**: `admin@empresa1.com`
- **Senha**: `eRR&KnFyuo&UI6d*`

#### USER (Usuário Comum)
- **Email**: `user@empresa1.com`
- **Senha**: `eRR&KnFyuo&UI6d*`

## 🔧 Comandos Úteis (pnpm)

Todos os comandos podem ser rodados da raiz:

```bash
# Instalar todas as dependências
pnpm install

# Limpar tudo (node_modules, builds)
pnpm run clean

# Buildar tudo
pnpm run build:all

# Rodar testes em tudo
pnpm run test:all
```

### Comandos de Banco de Dados (Prisma)

```bash
# Studio (Interface visual do banco)
pnpm --filter backend exec prisma studio

# Resetar banco
pnpm --filter backend exec prisma migrate reset
```

## ❌ Solução de Problemas

### Erro "Module not found"
**Solução**: Rode `pnpm install` na raiz novamente. Certifique-se de não ter pastas `node_modules` antigas criadas por `npm`.
Se necessário, rode `pnpm run clean` e instale de novo.

### Erro de Conexão com Banco
Verifique se a `DATABASE_URL` no arquivo `apps/backend/.env` está correta e se o serviço do PostgreSQL está rodando.

---
Para mais detalhes sobre como trabalhar com o workspace, leia o arquivo [WORKSPACE_GUIDE.md](./WORKSPACE_GUIDE.md).
