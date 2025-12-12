# ⚡ Início Rápido - 5 Minutos

Este guia vai te ajudar a ter o sistema rodando em **5 minutos**.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter:

- ✅ Node.js 18+ instalado
- ✅ PostgreSQL instalado e rodando
- ✅ npm ou yarn instalado

## 🚀 Passo a Passo

### Opção 1: Instalação Tradicional

#### 1️⃣ Configurar Backend (2 minutos)

```bash
# Entrar na pasta do backend
cd backend

# Instalar dependências
npm install

# O arquivo .env já está configurado com valores padrão
# Se necessário, edite backend/.env para ajustar a conexão do PostgreSQL

# Gerar Prisma Client
npm run prisma:generate

# Criar banco e executar migrations
npm run prisma:migrate

# Popular banco com dados de teste
npx ts-node prisma/seed.ts

# Iniciar servidor
npm run start:dev
```

✅ **Backend rodando em:** `http://localhost:4000`

#### 2️⃣ Configurar Frontend (2 minutos)

Abra um **novo terminal**:

```bash
# Entrar na pasta do frontend
cd frontend

# Instalar dependências
npm install

# O arquivo .env.local já está configurado
# Não precisa alterar nada

# Iniciar aplicação
npm run dev
```

✅ **Frontend rodando em:** `http://localhost:5000`

### Opção 2: Instalação com Docker (Recomendado)

#### 1️⃣ Configurar ambiente

```bash
# Backend
cd backend
cp .env.example .env
# Edite o arquivo .env com suas configurações

# Frontend
cd frontend
cp .env.local.example .env.local
# Edite o arquivo .env.local se necessário
```

#### 2️⃣ Iniciar serviços

```bash
# Desenvolvimento
docker-compose -f docker-compose.dev.yml up --build

# Produção
docker-compose up --build
```

#### 3️⃣ Executar migrações (apenas na primeira vez)

```bash
# Desenvolvimento
docker-compose -f docker-compose.dev.yml exec backend npm run prisma:migrate
docker-compose -f docker-compose.dev.yml exec backend npx ts-node prisma/seed.ts

# Produção
docker-compose exec backend npm run prisma:migrate
docker-compose exec backend npx ts-node prisma/seed.ts
```

✅ **Serviços Docker rodando em:**
- Frontend: `http://localhost:5000`
- Backend: `http://localhost:4000`

### 3️⃣ Acessar o Sistema (1 minuto)

1. Abra seu navegador em: `http://localhost:5000`
2. Você será redirecionado para a página de login
3. Use uma das credenciais abaixo:

#### 🔑 SUPER_ADMIN (Acesso Total)
```
Email: admin@system.com
Senha: admin123
```

#### 🔑 ADMIN (Tenant)
```
Email: admin@empresa1.com
Senha: admin123
```

#### 🔑 USER (Usuário Comum)
```
Email: user@empresa1.com
Senha: user123
```

## 🎯 Testando o Sistema

### Teste 1: Login como SUPER_ADMIN

1. Faça login com `admin@system.com` / `eRR&KnFyuo&UI6d*`
2. Você verá o **Dashboard**
3. No menu lateral, você verá:
   - ✅ Dashboard
   - ✅ Empresas (visível apenas para SUPER_ADMIN)
   - ✅ Configurações

### Teste 2: Cadastrar uma Empresa

1. Clique em **"Empresas"** no menu lateral
2. Clique em **"Nova Empresa"**
3. Preencha o formulário:
   ```
   Email: novaemp@example.com
   CNPJ/CPF: 98765432109876
   Nome Fantasia: Nova Empresa LTDA
   Nome do Responsável: Maria Santos
   Telefone: (21) 91234-5678
   ```
4. Clique em **"Cadastrar Empresa"**
5. A empresa aparecerá na lista

### Teste 3: Login como USER

1. Faça **logout** (botão no final do menu lateral)
2. Faça login com `user@empresa1.com` / `eRR&KnFyuo&UI6d*`
3. Observe que o menu **"Empresas"** não aparece
4. Tente acessar `http://localhost:5000/empresas` diretamente
5. Você será redirecionado para o Dashboard (sem permissão)

## 🎉 Pronto!

Seu sistema está funcionando! Agora você pode:

- ✅ Explorar o código-fonte
- ✅ Testar diferentes níveis de acesso
- ✅ Adicionar novas funcionalidades
- ✅ Ler a documentação completa

## 📚 Próximos Passos

### Entender a Arquitetura
Leia: `ARQUITETURA_SEGURANCA.md`

### Ver Exemplos de API
Leia: `API_EXAMPLES.md`

### Comandos Úteis
Leia: `COMANDOS_UTEIS.md`

### Documentação Completa
Leia: `README.md`

## ❌ Problemas Comuns

### Erro: "Port 3001 already in use"

**Solução:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### Erro: "Can't reach database server"

**Solução:**
1. Verifique se o PostgreSQL está rodando
2. Verifique o `backend/.env`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/multitenant_db?schema=public"
   ```
3. Ajuste usuário, senha e porta conforme sua instalação

### Erro: "Module not found"

**Solução:**
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

### Erro: "Prisma Client not generated"

**Solução:**
```bash
cd backend
npm run prisma:generate
```

## 🆘 Precisa de Ajuda?

1. Verifique a seção de **Troubleshooting** em `COMANDOS_UTEIS.md`
2. Consulte a documentação completa em `README.md`
3. Abra uma issue no repositório

## 📊 Estrutura do Projeto

```
projeto/
├── backend/              # API NestJS
│   ├── src/
│   │   ├── auth/        # Autenticação
│   │   ├── tenants/     # Empresas
│   │   ├── common/      # Guards, Interceptors
│   │   └── prisma/      # Banco de dados
│   └── prisma/
│       ├── schema.prisma # Schema do banco
│       └── seed.ts      # Dados iniciais
├── frontend/            # Interface Next.js
│   └── src/
│       ├── app/         # Páginas
│       ├── components/  # Componentes
│       ├── contexts/    # Contextos
│       └── lib/         # Utilitários
└── docs/                # Documentação
```

## 🔐 Segurança

Este sistema implementa:

- ✅ Hash de senhas com Bcrypt
- ✅ JWT com expiração
- ✅ Isolamento multitenant automático
- ✅ Controle de acesso por roles
- ✅ Validação rigorosa de dados
- ✅ CORS configurado
- ✅ Prevenção de IDOR

## 🎯 Casos de Uso

### SaaS Multitenant
Cada cliente tem seus dados isolados automaticamente.

### Plataforma de Gerenciamento
Administrador global gerencia múltiplas organizações.

### Sistema Corporativo
Diferentes departamentos com diferentes níveis de acesso.

## 📈 Próximas Funcionalidades

Veja o roadmap completo em: `CHECKLIST_IMPLEMENTACAO.md`

**Prioridades:**
1. Refresh token
2. CRUD de usuários
3. Testes unitários
4. Rate limiting
5. Swagger

## 💡 Dicas

### Desenvolvimento Simultâneo

Use o comando na raiz do projeto (requer `concurrently`):
```bash
npm install
npm run dev
```

Isso inicia backend e frontend simultaneamente!

### Prisma Studio

Visualize o banco de dados:
```bash
cd backend
npx prisma studio
```

Abre em: `http://localhost:5555`

### Hot Reload

Ambos backend e frontend têm hot reload ativado. Suas alterações serão refletidas automaticamente!

## 🎓 Aprendizado

Este projeto demonstra:

- ✅ Arquitetura modular (NestJS)
- ✅ App Router (Next.js 14)
- ✅ JWT Authentication
- ✅ RBAC (Role-Based Access Control)
- ✅ Multitenant Architecture
- ✅ TypeScript full-stack
- ✅ Prisma ORM
- ✅ Tailwind CSS + Radix UI

## 🏆 Você Conseguiu!

Parabéns! Você tem um sistema completo rodando com:

- ✅ Backend seguro com NestJS
- ✅ Frontend moderno com Next.js
- ✅ Isolamento multitenant
- ✅ Controle de acesso por roles
- ✅ Validação de dados
- ✅ Interface responsiva

**Agora é hora de explorar e adicionar suas próprias funcionalidades!** 🚀

