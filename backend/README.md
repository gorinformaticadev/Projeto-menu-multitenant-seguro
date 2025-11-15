# Backend - Sistema Multitenant com NestJS

Backend desenvolvido com NestJS 11, implementando segurança essencial e isolamento multitenant.

## 🚀 Tecnologias

- NestJS 11
- PostgreSQL
- Prisma ORM
- JWT (Passport)
- Bcrypt
- TypeScript

## 🔐 Recursos de Segurança

### 1. Autenticação e Hashing
- Senhas armazenadas com **Bcrypt** (hash seguro)
- JWT com payload contendo: `id`, `email`, `role`, `tenantId`
- Validação de token em todas as rotas protegidas

### 2. Isolamento Multitenant
- **TenantInterceptor**: Interceptor global que injeta `tenantId` em todas as requisições
- Usuários comuns só acessam dados do próprio tenant
- SUPER_ADMIN tem acesso global (sem filtro de tenant)

### 3. Controle de Acesso (RBAC)
- **RolesGuard**: Guard reutilizável para proteger rotas por role
- Roles disponíveis: `SUPER_ADMIN`, `ADMIN`, `USER`, `CLIENT`
- Rotas de Tenants protegidas apenas para SUPER_ADMIN

### 4. Validação Rigorosa
- **ValidationPipe** global com `class-validator`
- Validação de tipos, formatos e regras de negócio
- Whitelist ativada (remove campos não esperados)

### 5. Segurança HTTP
- **CORS** configurado para aceitar apenas o frontend
- Suporte a cookies com `SameSite=Strict` (se necessário)

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Copiar .env.example para .env e configurar
cp .env.example .env

# Gerar Prisma Client
npm run prisma:generate

# Executar migrations
npm run prisma:migrate

# Popular banco com dados iniciais
npx ts-node prisma/seed.ts
```

## 🏃 Executar

```bash
# Desenvolvimento
npm run start:dev

# Produção
npm run build
npm run start:prod
```

## 🔑 Credenciais de Teste

### SUPER_ADMIN
- Email: `admin@system.com`
- Senha: `admin123`
- Acesso: Todas as rotas, incluindo `/tenants`

### ADMIN (Tenant)
- Email: `admin@empresa1.com`
- Senha: `admin123`
- Acesso: Dados apenas do seu tenant

### USER
- Email: `user@empresa1.com`
- Senha: `user123`
- Acesso: Dados apenas do seu tenant

## 📡 Endpoints

### Autenticação
- `POST /auth/login` - Login (público)

### Tenants (Empresas)
- `GET /tenants` - Listar empresas (SUPER_ADMIN)
- `POST /tenants` - Criar empresa (SUPER_ADMIN)

## 🛡️ Arquitetura de Segurança

```
Request → CORS → ValidationPipe → JwtAuthGuard → RolesGuard → TenantInterceptor → Controller
```

1. **CORS**: Valida origem da requisição
2. **ValidationPipe**: Valida e transforma dados de entrada
3. **JwtAuthGuard**: Valida token JWT
4. **RolesGuard**: Verifica permissões por role
5. **TenantInterceptor**: Injeta tenantId para isolamento
6. **Controller**: Executa lógica de negócio

## 📝 Estrutura de Pastas

```
src/
├── auth/                 # Módulo de autenticação
│   ├── strategies/       # JWT Strategy
│   ├── dto/             # DTOs de login
│   └── auth.service.ts  # Lógica de autenticação
├── common/              # Recursos compartilhados
│   ├── guards/          # Guards (JWT, Roles)
│   ├── interceptors/    # Interceptors (Tenant)
│   └── decorators/      # Decorators customizados
├── tenants/             # Módulo de empresas
│   ├── dto/            # DTOs de tenant
│   └── tenants.service.ts
├── prisma/              # Prisma Service
└── main.ts             # Bootstrap da aplicação
```
