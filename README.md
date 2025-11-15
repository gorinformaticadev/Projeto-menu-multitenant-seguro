# 🔒 Sistema Multitenant com Segurança Essencial

Sistema web completo com backend NestJS e frontend Next.js, implementando isolamento multitenant e controle de acesso baseado em roles (RBAC).

> 👋 **Novo aqui?** Comece pelo [BOAS_VINDAS.md](BOAS_VINDAS.md) para um guia completo de início!
> 
> ⚡ **Quer começar rápido?** Vá direto para [INICIO_RAPIDO.md](INICIO_RAPIDO.md) (5 minutos)

## 📋 Visão Geral

Este projeto demonstra a implementação de um sistema seguro com:

- **Backend**: NestJS 11 com PostgreSQL e Prisma
- **Frontend**: Next.js 14 com Tailwind CSS e Radix UI
- **Segurança**: JWT, Bcrypt, Guards, Interceptors, CORS
- **Isolamento**: Multitenant com filtro automático por tenantId

## 🏗️ Arquitetura

```
projeto/
├── backend/          # NestJS API
│   ├── src/
│   │   ├── auth/           # Autenticação JWT
│   │   ├── tenants/        # Gerenciamento de empresas
│   │   ├── common/         # Guards, Interceptors, Decorators
│   │   └── prisma/         # Prisma ORM
│   └── prisma/
│       ├── schema.prisma   # Schema do banco
│       └── seed.ts         # Dados iniciais
└── frontend/         # Next.js App
    └── src/
        ├── app/            # Páginas (App Router)
        ├── components/     # Componentes React
        ├── contexts/       # Contextos (Auth)
        └── lib/            # Utilitários
```

## 🔐 Recursos de Segurança Implementados

### Backend (NestJS)

#### 1. Autenticação e Hashing
- ✅ Senhas com **Bcrypt** (hash + salt)
- ✅ JWT com payload: `id`, `email`, `role`, `tenantId`
- ✅ Validação de token em todas as rotas protegidas

#### 2. Isolamento Multitenant
- ✅ **TenantInterceptor**: Injeta `tenantId` automaticamente
- ✅ Usuários só acessam dados do próprio tenant
- ✅ SUPER_ADMIN tem acesso global (sem filtro)

#### 3. Controle de Acesso (RBAC)
- ✅ **RolesGuard**: Protege rotas por role
- ✅ Roles: `SUPER_ADMIN`, `ADMIN`, `USER`, `CLIENT`
- ✅ Rotas de Tenants protegidas para SUPER_ADMIN

#### 4. Validação Rigorosa
- ✅ **ValidationPipe** global com `class-validator`
- ✅ Validação de tipos, formatos e regras de negócio
- ✅ Whitelist ativada (remove campos não esperados)

#### 5. Segurança HTTP
- ✅ **CORS** configurado para aceitar apenas o frontend
- ✅ Suporte a cookies com `SameSite=Strict`

### Frontend (Next.js)

#### 1. Armazenamento Seguro
- ✅ Simulação de armazenamento seguro (Electron Keytar)
- ✅ Token JWT não exposto em `localStorage`

#### 2. Controle de Acesso
- ✅ Componente `ProtectedRoute` para proteger páginas
- ✅ Verificação de roles antes de renderizar
- ✅ Redirecionamento automático se não autorizado

#### 3. Validação no Cliente
- ✅ Validação de formulários antes de enviar
- ✅ Mensagens de erro genéricas (não expõe detalhes)

#### 4. Requisições Seguras
- ✅ Interceptor Axios para tratamento de erros
- ✅ Redirecionamento em caso de token expirado

## 🚀 Instalação e Execução

### Pré-requisitos

- Node.js 18+
- PostgreSQL
- npm ou yarn

### 1. Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar .env
cp .env.example .env
# Editar .env com suas configurações do PostgreSQL

# Gerar Prisma Client
npm run prisma:generate

# Executar migrations
npm run prisma:migrate

# Popular banco com dados iniciais
npx ts-node prisma/seed.ts

# Iniciar servidor
npm run start:dev
```

O backend estará rodando em `http://localhost:3001`

### 2. Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Configurar .env.local
cp .env.local.example .env.local
# Editar .env.local se necessário

# Iniciar aplicação
npm run dev
```

O frontend estará rodando em `http://localhost:3000`

## 🔑 Credenciais de Teste

Após executar o seed, você terá os seguintes usuários:

### SUPER_ADMIN
- **Email**: `admin@system.com`
- **Senha**: `admin123`
- **Acesso**: Todas as rotas, incluindo `/tenants`

### ADMIN (Tenant)
- **Email**: `admin@empresa1.com`
- **Senha**: `admin123`
- **Acesso**: Dados apenas do seu tenant

### USER
- **Email**: `user@empresa1.com`
- **Senha**: `user123`
- **Acesso**: Dados apenas do seu tenant

## 📡 Endpoints da API

### Autenticação
- `POST /auth/login` - Login (público)

### Tenants (Empresas)
- `GET /tenants` - Listar empresas (SUPER_ADMIN)
- `POST /tenants` - Criar empresa (SUPER_ADMIN)

## 🗺️ Rotas do Frontend

### Públicas
- `/` - Redirecionamento automático
- `/login` - Página de login

### Protegidas
- `/dashboard` - Dashboard (todos os usuários)
- `/empresas` - Gerenciamento de empresas (SUPER_ADMIN)
- `/configuracoes` - Configurações (SUPER_ADMIN e ADMIN)

## 🛡️ Fluxo de Segurança

```
Request → CORS → ValidationPipe → JwtAuthGuard → RolesGuard → TenantInterceptor → Controller
```

1. **CORS**: Valida origem da requisição
2. **ValidationPipe**: Valida e transforma dados
3. **JwtAuthGuard**: Valida token JWT
4. **RolesGuard**: Verifica permissões por role
5. **TenantInterceptor**: Injeta tenantId para isolamento
6. **Controller**: Executa lógica de negócio

## 📊 Modelo de Dados

### User
- `id`: UUID
- `email`: String (único)
- `password`: String (hash Bcrypt)
- `name`: String
- `role`: Enum (SUPER_ADMIN, ADMIN, USER, CLIENT)
- `tenantId`: UUID (nullable)

### Tenant
- `id`: UUID
- `email`: String (único)
- `cnpjCpf`: String (único)
- `nomeFantasia`: String
- `nomeResponsavel`: String
- `telefone`: String

## 🎯 Funcionalidades Implementadas

### ✅ Backend
- [x] Autenticação JWT com Bcrypt
- [x] Isolamento multitenant com Interceptor
- [x] Guards de Roles (RBAC)
- [x] Validação rigorosa com class-validator
- [x] CORS configurado
- [x] Endpoints de Tenants protegidos
- [x] Seed com dados iniciais

### ✅ Frontend
- [x] Página de login com validação
- [x] Dashboard com informações do usuário
- [x] Sidebar com visibilidade condicional
- [x] Página de empresas (SUPER_ADMIN)
- [x] Formulário de cadastro de empresas
- [x] Proteção de rotas por role
- [x] Armazenamento seguro de token
- [x] Tratamento de erros

## 🔧 Tecnologias Utilizadas

### Backend
- NestJS 11
- PostgreSQL
- Prisma ORM
- Passport JWT
- Bcrypt
- class-validator
- class-transformer

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Radix UI
- Axios
- Lucide Icons

## 📝 Próximos Passos

- [ ] Implementar refresh token
- [ ] Adicionar testes unitários e e2e
- [ ] Implementar CRUD completo de usuários
- [ ] Adicionar logs de auditoria
- [ ] Implementar rate limiting
- [ ] Adicionar documentação Swagger
- [ ] Implementar recuperação de senha
- [ ] Adicionar autenticação de dois fatores (2FA)

## 📄 Licença

Este projeto é um exemplo educacional e pode ser usado livremente.

## 👨‍💻 Autor

Sistema desenvolvido como demonstração de boas práticas de segurança em aplicações web.
