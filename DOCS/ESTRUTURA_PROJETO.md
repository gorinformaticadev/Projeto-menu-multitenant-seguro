# Estrutura do Projeto

Organizacao de pastas e arquivos do projeto Pluggor.

## Arvore de Diretorios

```
Pluggor/
├── apps/
│   ├── backend/                      # API NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Schema do banco de dados
│   │   │   ├── migrations/          # Migrations do Prisma
│   │   │   └── seed.ts              # Script de seed
│   │   ├── src/
│   │   │   ├── auth/                # Autenticacao JWT
│   │   │   ├── common/              # Guards, interceptors, decorators
│   │   │   ├── prisma/              # Modulo Prisma
│   │   │   ├── modules/             # Modulos do sistema
│   │   │   ├── security-config/     # Configuracoes de seguranca
│   │   │   ├── app.module.ts        # Modulo principal
│   │   │   └── main.ts              # Bootstrap
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                     # Aplicacao Next.js
│       ├── src/
│       │   ├── app/                  # App Router
│       │   ├── components/           # Componentes React
│       │   ├── contexts/             # Contextos React
│       │   ├── hooks/                # Hooks customizados
│       │   ├── lib/                  # Utilitarios (api, utils)
│       │   └── theme/                # Sistema de temas
│       ├── package.json
│       └── next.config.mjs
│
├── install/                          # Scripts oficiais de instalacao
│   ├── install.sh                   # Instalacao principal
│   ├── update.sh                    # Atualizacao
│   ├── uninstall.sh                 # Desinstalacao
│   └── check.sh                     # Validacao
│
├── DOCS/                             # Documentacao tecnica
├── Scripts/                          # Scripts auxiliares
├── docker-compose.yml                # Docker Compose base
├── docker-compose.dev.yml            # Desenvolvimento
├── docker-compose.prod.yml           # Producao
├── package.json                      # Workspace root (pnpm)
├── pnpm-workspace.yaml              # Configuracao workspace
└── README.md                         # Documentacao principal
```

## Descricao das Pastas

### Backend (`apps/backend/`)

#### `src/auth/`
Modulo de autenticacao de usuarios.
- `auth.controller.ts` - Endpoint de login
- `auth.service.ts` - Logica de autenticacao (Bcrypt, JWT)
- `jwt.strategy.ts` - Validacao de tokens JWT

#### `src/common/`
Recursos compartilhados entre modulos.
- `guards/` - Guards de seguranca (JwtAuthGuard, RolesGuard)
- `interceptors/` - Interceptors (TenantInterceptor)
- `decorators/` - Decorators (@Roles, @CurrentUser, @SkipTenantIsolation)

#### `src/modules/`
Modulos dinamicos do sistema (instalados via upload ZIP).

#### `prisma/`
Configuracao do Prisma ORM.
- `schema.prisma` - Schema do banco
- `migrations/` - Migrations versionadas

### Frontend (`apps/frontend/`)

#### `src/app/`
Paginas da aplicacao (App Router Next.js).
- `login/` - Pagina de login
- `dashboard/` - Dashboard principal
- `configuracoes/` - Configuracoes do sistema
- `modules/` - Paginas de modulos dinamicos

#### `src/components/`
Componentes React reutilizais.
- `ui/` - Componentes UI (Button, Card, Input, etc)
- `Sidebar.tsx` - Menu lateral
- `TopBar.tsx` - Barra superior

#### `src/theme/`
Sistema de temas (tokens CSS, temas light/dark).

### Scripts (`install/`)

Scripts oficiais para ciclo de vida do sistema:
- `install.sh` - Instalacao (Docker ou native/PM2)
- `update.sh` - Atualizacao via Git
- `uninstall.sh` - Desinstalacao completa
- `check.sh` - Validacao de ambiente
- `restore-db.sh` - Restore via API interna (Docker)
- `restore-native.sh` - Restore via API interna (native)
- `renew-cert.sh` - Renovacao de certificado SSL

## Convencoes de Nomenclatura

### Backend (NestJS)
- Modulos: `*.module.ts`
- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- DTOs: `*.dto.ts`
- Guards: `*.guard.ts`

### Frontend (Next.js)
- Paginas: `page.tsx`
- Layouts: `layout.tsx`
- Componentes: `PascalCase.tsx`
- Hooks: `use-*.ts`
- Utilitarios: `camelCase.ts`

## Stack Tecnologica

### Backend
- NestJS (Framework Node.js)
- Prisma ORM (PostgreSQL)
- Passport JWT (Autenticacao)
- Bcrypt (Hash de senhas)
- class-validator (Validacao)
- Socket.IO (WebSocket)

### Frontend
- Next.js (Framework React)
- React 18+
- TypeScript
- Tailwind CSS
- Radix UI (Componentes)
- Axios (Cliente HTTP)
- next-themes (Temas)

### Infraestrutura
- PostgreSQL (Banco de dados)
- Redis (Cache/Sessions)
- Docker (Containers)
- pnpm (Gerenciador de pacotes, workspace)
