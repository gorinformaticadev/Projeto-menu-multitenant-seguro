# 🚀 Guia de Instalação Rápida

## Pré-requisitos

- Node.js 18 ou superior
- PostgreSQL instalado e rodando
- npm ou yarn

## Passo 1: Clonar e Configurar Backend

```bash
# Entrar na pasta do backend
cd backend

# Instalar dependências
npm install

# Criar arquivo .env
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações do PostgreSQL:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_do_banco?schema=public"
JWT_SECRET="sua-chave-secreta-super-segura-aqui"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:5000"
PORT=3001
```

```bash
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
```

✅ Backend rodando em `http://localhost:4000`

## Passo 2: Configurar Frontend

Abra um novo terminal:

```bash
# Entrar na pasta do frontend
cd frontend

# Instalar dependências
npm install

# Criar arquivo .env.local
cp .env.local.example .env.local
```

O arquivo `.env.local` já está configurado corretamente:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

```bash
# Iniciar aplicação frontend
npm run dev
```

✅ Frontend rodando em `http://localhost:5000`

## Passo 3: Acessar o Sistema

Abra seu navegador em `http://localhost:5000`

### Credenciais de Teste

#### SUPER_ADMIN (Acesso Total)
- **Email**: `admin@system.com`
- **Senha**: `eRR&KnFyuo&UI6d*`
- **Pode acessar**: Dashboard, Empresas, Configurações

#### ADMIN (Tenant)
- **Email**: `admin@empresa1.com`
- **Senha**: `eRR&KnFyuo&UI6d*`
- **Pode acessar**: Dashboard, Configurações (apenas do seu tenant)

#### USER (Usuário Comum)
- **Email**: `user@empresa1.com`
- **Senha**: `eRR&KnFyuo&UI6d*`
- **Pode acessar**: Dashboard (apenas dados do seu tenant)

## 🎯 Testando o Sistema

### 1. Testar Login
- Acesse `http://localhost:5000/login`
- Faça login com qualquer uma das credenciais acima
- Você será redirecionado para o dashboard

### 2. Testar Isolamento Multitenant
- Faça login como `user@empresa1.com`
- Observe que o menu "Empresas" não aparece (apenas SUPER_ADMIN)
- Faça logout e login como `admin@system.com`
- Agora o menu "Empresas" está visível

### 3. Testar Cadastro de Empresas
- Faça login como `admin@system.com` (SUPER_ADMIN)
- Clique em "Empresas" no menu lateral
- Clique em "Nova Empresa"
- Preencha o formulário e cadastre uma nova empresa
- A empresa aparecerá na lista

### 4. Testar Segurança
- Tente acessar `http://localhost:5000/empresas` sem estar logado
  - Você será redirecionado para o login
- Faça login como `user@empresa1.com` (USER)
- Tente acessar `http://localhost:5000/empresas`
  - Você será redirecionado para o dashboard (sem permissão)

## 🔧 Comandos Úteis

### Backend

```bash
# Ver logs do Prisma
npx prisma studio

# Resetar banco de dados
npx prisma migrate reset

# Criar nova migration
npx prisma migrate dev --name nome_da_migration
```

### Frontend

```bash
# Limpar cache do Next.js
rm -rf .next

# Build para produção
npm run build

# Executar build de produção
npm start
```

## ❌ Solução de Problemas

### Erro de conexão com PostgreSQL

```
Error: Can't reach database server at `localhost:5432`
```

**Solução**: Verifique se o PostgreSQL está rodando:

```bash
# Windows
# Abra o "Serviços" e verifique se PostgreSQL está ativo

# Linux/Mac
sudo service postgresql status
```

### Erro "Port 3001 already in use"

**Solução**: Mate o processo que está usando a porta:

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

Ou todos os processos
taskkill /F /IM node.exe

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### Erro "Module not found"

**Solução**: Reinstale as dependências:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro no Prisma Client

**Solução**: Regenere o Prisma Client:

```bash
cd backend
npm run prisma:generate
```


## 📚 Próximos Passos

Após a instalação, você pode:

1. Explorar o código-fonte para entender a arquitetura
2. Ler a documentação completa no `README.md`
3. Testar os diferentes níveis de acesso
4. Modificar e adicionar novas funcionalidades
5. Implementar novos módulos seguindo os padrões de segurança

## 🆘 Precisa de Ajuda?

- Verifique o `README.md` principal para documentação completa
- Verifique o `backend/README.md` para detalhes do backend
- Verifique o `frontend/README.md` para detalhes do frontend

