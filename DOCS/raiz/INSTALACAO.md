# 🚀 Guia de Instalação Rápida (Localhost Dev / pnpm Workspace)

Este projeto utiliza **pnpm workspace**. As dependências dos apps (backend e frontend) são gerenciadas a partir da raiz do projeto.

## Pré-requisitos

- Node.js 20 ou superior
- PostgreSQL instalado e rodando (versão 14+)
- **pnpm** instalado globalmente (`npm install -g pnpm`)

## Passo 1: Instalação e Configuração

1.  **Instalar dependências (na raiz)**
    ```bash
    pnpm install
    ```
    *Isso instala as dependências do backend e do frontend automaticamente.*

2.  **Configurar Variáveis de Ambiente**

    *Backend:*
    ```bash
    cp apps/backend/.env.example apps/backend/.env
    ```
    Edite `apps/backend/.env` e configure a `DATABASE_URL` com as credenciais do seu PostgreSQL local.
    *(Exemplo: `postgresql://postgres:suasenha@localhost:5432/multitenant_db?schema=public`)*

    *Frontend:*
    ```bash
    cp apps/frontend/.env.local.example apps/frontend/.env.local
    ```

3.  **Configurar Banco de Dados (Prisma)**
    
    Certifique-se de estar na raiz do projeto ao rodar estes comandos:
    ```bash
    # 1. Gerar o Prisma Client
    pnpm --filter backend run prisma:generate

    # 2. Executar as Migrations (cria o banco e as tabelas em dev)
    pnpm --filter backend exec prisma migrate dev

    # 3. Popular o banco com dados iniciais e usuários de teste
    cd apps/backend
    pnpm dlx ts-node prisma/seed.ts deploy --force
    cd ../..
    ```

## Passo 2: Rodar o Projeto

Você pode iniciar os servidores diretamente da raiz do projeto em terminais separados:

**Terminal 1 (Backend):**
```bash
# Inicia o Backend (Porta 4000)
pnpm run dev:backend
```

**Terminal 2 (Frontend):**
```bash
# Inicia o Frontend (Porta 5000)
pnpm run dev:frontend
```

## Passo 3: Acessar o Sistema

Abra seu navegador em `http://localhost:5000`

### Credenciais Padrão (Criadas pelo Seed)

#### SUPER_ADMIN (Acesso Total)
- **Email**: `admin@system.com`
- **Senha**: `eRR&KnFyuo&UI6d*`

#### ADMIN (Tenant)
- **Email**: `admin@empresa1.com`
- **Senha**: `eRR&KnFyuo&UI6d*`

#### USER (Usuário Comum)
- **Email**: `user@empresa1.com`
- **Senha**: `eRR&KnFyuo&UI6d*`

## 🔧 Comandos Úteis (Raiz)

```bash
# Limpar tudo (node_modules, builds, dist)
pnpm run clean

# Reinstalar todas as dependências
pnpm install

# Buildar tudo (frontend e backend)
pnpm run build:all

# Abrir o Prisma Studio (Interface visual do banco)
pnpm --filter backend exec prisma studio
```

## ❌ Solução de Problemas

### Erro "Module not found" ou Erros de tipagem
**Solução**: Rode `pnpm run clean` na raiz, e depois `pnpm install`. Certifique-se de não ter pastas `node_modules` avulsas instaladas via `npm` ignorando o workspace.

### Erro "Database does not exist" ao rodar migrate
Se o Prisma não conseguir criar o banco automaticamente, crie-o manualmente no psql:
```bash
psql -U postgres -c "CREATE DATABASE multitenant_db;"
```
Em seguida, rode o `migrate dev` novamente.

### Resetar Banco de Dados localmente
Se precisar apagar os dados e recriar o banco do zero:
```bash
pnpm --filter backend exec prisma migrate reset
cd apps/backend
pnpm dlx ts-node prisma/seed.ts deploy --force
cd ../..
```

---
Para mais detalhes sobre as regras de workspace e pacotes, consulte o [WORKSPACE_GUIDE.md](./WORKSPACE_GUIDE.md).
