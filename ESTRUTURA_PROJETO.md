# 📁 Estrutura do Projeto

Este documento detalha a organização de pastas e arquivos do projeto.

## 🌳 Árvore de Diretórios

```
projeto/
├── backend/                          # Backend NestJS
│   ├── prisma/                       # Prisma ORM
│   │   ├── schema.prisma            # Schema do banco de dados
│   │   └── seed.ts                  # Script de seed (dados iniciais)
│   ├── src/                         # Código-fonte
│   │   ├── auth/                    # Módulo de Autenticação
│   │   │   ├── dto/                 # Data Transfer Objects
│   │   │   │   └── login.dto.ts    # DTO de login
│   │   │   ├── strategies/          # Estratégias Passport
│   │   │   │   └── jwt.strategy.ts # Estratégia JWT
│   │   │   ├── auth.controller.ts  # Controller de autenticação
│   │   │   ├── auth.module.ts      # Módulo de autenticação
│   │   │   └── auth.service.ts     # Service de autenticação
│   │   ├── common/                  # Recursos compartilhados
│   │   │   ├── decorators/          # Decorators customizados
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   └── skip-tenant-isolation.decorator.ts
│   │   │   ├── guards/              # Guards de segurança
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   └── interceptors/        # Interceptors
│   │   │       └── tenant.interceptor.ts
│   │   ├── prisma/                  # Módulo Prisma
│   │   │   ├── prisma.module.ts    # Módulo Prisma
│   │   │   └── prisma.service.ts   # Service Prisma
│   │   ├── tenants/                 # Módulo de Tenants
│   │   │   ├── dto/                 # Data Transfer Objects
│   │   │   │   └── create-tenant.dto.ts
│   │   │   ├── tenants.controller.ts
│   │   │   ├── tenants.module.ts
│   │   │   └── tenants.service.ts
│   │   ├── app.module.ts            # Módulo principal
│   │   └── main.ts                  # Bootstrap da aplicação
│   ├── .env                         # Variáveis de ambiente
│   ├── .env.example                 # Exemplo de .env
│   ├── nest-cli.json                # Configuração NestJS CLI
│   ├── package.json                 # Dependências backend
│   ├── tsconfig.json                # Configuração TypeScript
│   ├── API_EXAMPLES.md              # Exemplos de API
│   └── README.md                    # Documentação backend
├── frontend/                         # Frontend Next.js
│   ├── src/                         # Código-fonte
│   │   ├── app/                     # App Router (Next.js 14)
│   │   │   ├── dashboard/           # Rota /dashboard
│   │   │   │   ├── layout.tsx      # Layout do dashboard
│   │   │   │   └── page.tsx        # Página do dashboard
│   │   │   ├── empresas/            # Rota /empresas
│   │   │   │   └── page.tsx        # Página de empresas
│   │   │   ├── configuracoes/       # Rota /configuracoes
│   │   │   │   └── page.tsx        # Página de configurações
│   │   │   ├── login/               # Rota /login
│   │   │   │   └── page.tsx        # Página de login
│   │   │   ├── layout.tsx           # Layout raiz
│   │   │   ├── page.tsx             # Página inicial
│   │   │   └── globals.css          # Estilos globais
│   │   ├── components/              # Componentes React
│   │   │   ├── ui/                  # Componentes UI (Radix)
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── toaster.tsx
│   │   │   ├── ProtectedRoute.tsx   # HOC de proteção
│   │   │   └── Sidebar.tsx          # Menu lateral
│   │   ├── contexts/                # Contextos React
│   │   │   └── AuthContext.tsx     # Contexto de autenticação
│   │   ├── hooks/                   # Hooks customizados
│   │   │   └── use-toast.ts        # Hook de toast
│   │   └── lib/                     # Utilitários
│   │       ├── api.ts              # Cliente Axios
│   │       └── utils.ts            # Funções utilitárias
│   ├── .env.local                   # Variáveis de ambiente
│   ├── .env.local.example           # Exemplo de .env.local
│   ├── next.config.js               # Configuração Next.js
│   ├── package.json                 # Dependências frontend
│   ├── postcss.config.js            # Configuração PostCSS
│   ├── tailwind.config.ts           # Configuração Tailwind
│   ├── tsconfig.json                # Configuração TypeScript
│   └── README.md                    # Documentação frontend
├── .gitignore                        # Arquivos ignorados pelo Git
├── LICENSE                           # Licença MIT
├── package.json                      # Scripts raiz
├── README.md                         # Documentação principal
├── INSTALACAO.md                     # Guia de instalação
├── INICIO_RAPIDO.md                  # Início rápido (5 min)
├── ARQUITETURA_SEGURANCA.md          # Arquitetura de segurança
├── DIAGRAMA_SISTEMA.md               # Diagramas visuais
├── COMANDOS_UTEIS.md                 # Comandos úteis
├── CHECKLIST_IMPLEMENTACAO.md        # Checklist e roadmap
├── SEGURANCA_PRODUCAO.md             # Segurança em produção
├── RESUMO_EXECUTIVO.md               # Resumo executivo
└── ESTRUTURA_PROJETO.md              # Este arquivo
```

## 📂 Descrição das Pastas

### Backend

#### `/backend/src/auth`
Módulo responsável pela autenticação de usuários.

**Arquivos principais:**
- `auth.controller.ts` - Endpoint de login
- `auth.service.ts` - Lógica de autenticação (Bcrypt, JWT)
- `jwt.strategy.ts` - Validação de tokens JWT

#### `/backend/src/common`
Recursos compartilhados entre módulos.

**Subpastas:**
- `decorators/` - Decorators customizados (@Roles, @CurrentUser, etc)
- `guards/` - Guards de segurança (JwtAuthGuard, RolesGuard)
- `interceptors/` - Interceptors (TenantInterceptor)

#### `/backend/src/tenants`
Módulo de gerenciamento de empresas (tenants).

**Arquivos principais:**
- `tenants.controller.ts` - Endpoints de tenants
- `tenants.service.ts` - Lógica de negócio
- `create-tenant.dto.ts` - Validação de dados

#### `/backend/src/prisma`
Módulo de conexão com o banco de dados.

**Arquivos principais:**
- `prisma.service.ts` - Cliente Prisma
- `prisma.module.ts` - Módulo global

#### `/backend/prisma`
Configuração do Prisma ORM.

**Arquivos principais:**
- `schema.prisma` - Schema do banco (User, Tenant)
- `seed.ts` - Dados iniciais (usuários de teste)

### Frontend

#### `/frontend/src/app`
Páginas da aplicação (App Router do Next.js 14).

**Estrutura:**
- `layout.tsx` - Layout raiz (AuthProvider, Toaster)
- `page.tsx` - Página inicial (redirecionamento)
- `login/` - Página de login
- `dashboard/` - Dashboard protegido
- `empresas/` - Gerenciamento de empresas (SUPER_ADMIN)
- `configuracoes/` - Configurações (SUPER_ADMIN e ADMIN)

#### `/frontend/src/components`
Componentes React reutilizáveis.

**Subpastas:**
- `ui/` - Componentes UI do Radix (Button, Card, Input, etc)
- `Sidebar.tsx` - Menu lateral com navegação
- `ProtectedRoute.tsx` - HOC para proteger rotas

#### `/frontend/src/contexts`
Contextos React para gerenciamento de estado.

**Arquivos principais:**
- `AuthContext.tsx` - Gerencia autenticação, login, logout

#### `/frontend/src/lib`
Utilitários e configurações.

**Arquivos principais:**
- `api.ts` - Cliente Axios configurado
- `utils.ts` - Funções utilitárias (cn, etc)

## 📄 Arquivos Importantes

### Configuração

#### Backend
- `.env` - Variáveis de ambiente (DATABASE_URL, JWT_SECRET)
- `nest-cli.json` - Configuração do NestJS CLI
- `tsconfig.json` - Configuração do TypeScript
- `package.json` - Dependências e scripts

#### Frontend
- `.env.local` - Variáveis de ambiente (NEXT_PUBLIC_API_URL)
- `next.config.js` - Configuração do Next.js
- `tailwind.config.ts` - Configuração do Tailwind CSS
- `tsconfig.json` - Configuração do TypeScript
- `package.json` - Dependências e scripts

### Documentação

- `README.md` - Documentação principal
- `INSTALACAO.md` - Guia de instalação detalhado
- `INICIO_RAPIDO.md` - Guia de início rápido (5 min)
- `ARQUITETURA_SEGURANCA.md` - Detalhes de segurança
- `DIAGRAMA_SISTEMA.md` - Diagramas visuais
- `API_EXAMPLES.md` - Exemplos de requisições
- `COMANDOS_UTEIS.md` - Comandos úteis
- `CHECKLIST_IMPLEMENTACAO.md` - Funcionalidades e roadmap
- `SEGURANCA_PRODUCAO.md` - Segurança em produção
- `RESUMO_EXECUTIVO.md` - Resumo executivo
- `ESTRUTURA_PROJETO.md` - Este arquivo

## 🔍 Convenções de Nomenclatura

### Backend (NestJS)

#### Módulos
- `*.module.ts` - Módulos NestJS
- Exemplo: `auth.module.ts`, `tenants.module.ts`

#### Controllers
- `*.controller.ts` - Controllers (endpoints)
- Exemplo: `auth.controller.ts`, `tenants.controller.ts`

#### Services
- `*.service.ts` - Services (lógica de negócio)
- Exemplo: `auth.service.ts`, `tenants.service.ts`

#### DTOs
- `*.dto.ts` - Data Transfer Objects
- Exemplo: `login.dto.ts`, `create-tenant.dto.ts`

#### Guards
- `*.guard.ts` - Guards de segurança
- Exemplo: `jwt-auth.guard.ts`, `roles.guard.ts`

#### Interceptors
- `*.interceptor.ts` - Interceptors
- Exemplo: `tenant.interceptor.ts`

#### Decorators
- `*.decorator.ts` - Decorators customizados
- Exemplo: `roles.decorator.ts`, `current-user.decorator.ts`

### Frontend (Next.js)

#### Páginas
- `page.tsx` - Páginas (App Router)
- `layout.tsx` - Layouts

#### Componentes
- `PascalCase.tsx` - Componentes React
- Exemplo: `Sidebar.tsx`, `ProtectedRoute.tsx`

#### Contextos
- `*Context.tsx` - Contextos React
- Exemplo: `AuthContext.tsx`

#### Hooks
- `use-*.ts` - Hooks customizados
- Exemplo: `use-toast.ts`

#### Utilitários
- `camelCase.ts` - Funções utilitárias
- Exemplo: `api.ts`, `utils.ts`

## 📊 Estatísticas do Projeto

### Linhas de Código

| Categoria | Linhas |
|-----------|--------|
| Backend | ~2.000 |
| Frontend | ~1.500 |
| Documentação | ~5.000 |
| **Total** | **~8.500** |

### Arquivos

| Categoria | Quantidade |
|-----------|------------|
| Backend | 20+ |
| Frontend | 25+ |
| Documentação | 12 |
| Configuração | 10+ |
| **Total** | **~67** |

### Módulos

| Módulo | Arquivos |
|--------|----------|
| Auth | 5 |
| Tenants | 4 |
| Common | 6 |
| Prisma | 3 |
| **Total Backend** | **18** |

| Módulo | Arquivos |
|--------|----------|
| Pages | 6 |
| Components | 8 |
| Contexts | 1 |
| Lib | 2 |
| **Total Frontend** | **17** |

## 🎯 Padrões de Organização

### Backend

#### Estrutura de Módulo
```
module-name/
├── dto/                    # Data Transfer Objects
│   ├── create-*.dto.ts
│   └── update-*.dto.ts
├── entities/               # Entidades (se necessário)
│   └── *.entity.ts
├── *.controller.ts         # Controller
├── *.service.ts            # Service
└── *.module.ts             # Module
```

#### Exemplo: Módulo de Usuários (futuro)
```
users/
├── dto/
│   ├── create-user.dto.ts
│   └── update-user.dto.ts
├── users.controller.ts
├── users.service.ts
└── users.module.ts
```

### Frontend

#### Estrutura de Página
```
route-name/
├── components/             # Componentes específicos da página
│   └── *.tsx
├── layout.tsx              # Layout da rota
└── page.tsx                # Página principal
```

#### Exemplo: Página de Usuários (futuro)
```
usuarios/
├── components/
│   ├── UserForm.tsx
│   └── UserList.tsx
├── layout.tsx
└── page.tsx
```

## 🔄 Fluxo de Dados

### Backend
```
Request → Controller → Service → Prisma → Database
                ↓
            Response
```

### Frontend
```
User Action → Component → Context/Hook → API (Axios) → Backend
                                ↓
                            Update State
                                ↓
                            Re-render
```

## 📝 Notas

### Adicionando Novos Módulos

#### Backend
1. Criar pasta em `src/`
2. Criar `*.module.ts`, `*.controller.ts`, `*.service.ts`
3. Criar DTOs em `dto/`
4. Importar módulo em `app.module.ts`

#### Frontend
1. Criar pasta em `src/app/`
2. Criar `page.tsx` (e `layout.tsx` se necessário)
3. Adicionar rota no `Sidebar.tsx`
4. Adicionar proteção com `ProtectedRoute` se necessário

### Boas Práticas

- ✅ Um arquivo por classe/componente
- ✅ Nomes descritivos e consistentes
- ✅ Separação de responsabilidades
- ✅ Reutilização de código
- ✅ Documentação inline quando necessário

## 🎓 Recursos de Aprendizado

Para entender melhor a estrutura:

1. **NestJS:** https://docs.nestjs.com/
2. **Next.js:** https://nextjs.org/docs
3. **Prisma:** https://www.prisma.io/docs
4. **Tailwind CSS:** https://tailwindcss.com/docs
5. **Radix UI:** https://www.radix-ui.com/docs

## 🔍 Navegação Rápida

### Backend
- Autenticação: `backend/src/auth/`
- Tenants: `backend/src/tenants/`
- Segurança: `backend/src/common/`
- Banco: `backend/prisma/`

### Frontend
- Páginas: `frontend/src/app/`
- Componentes: `frontend/src/components/`
- Autenticação: `frontend/src/contexts/AuthContext.tsx`
- API: `frontend/src/lib/api.ts`

### Documentação
- Início Rápido: `INICIO_RAPIDO.md`
- Instalação: `INSTALACAO.md`
- Segurança: `ARQUITETURA_SEGURANCA.md`
- API: `API_EXAMPLES.md`
