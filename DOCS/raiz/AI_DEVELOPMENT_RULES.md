# Regras de Desenvolvimento para IA

## Visao Geral

Sistema SaaS multitenant com isolamento de dados, controle RBAC e implantacao simplificada via Docker.

### Stack
- **Backend:** NestJS 11 + TypeScript (pnpm workspace)
- **Frontend:** Next.js 16 + React 19 + TypeScript
- **Banco:** PostgreSQL + Prisma ORM 6.19
- **Cache:** Redis (ioredis + redis)
- **Auth:** JWT + 2FA (TOTP/speakeasy)
- **WS:** Socket.IO + Redis Adapter
- **Estilo:** Tailwind CSS 3 + Radix UI + MUI 7
- **Monitoramento:** Sentry
- **Pacotes:** pnpm monorepo

---

## Dependencias Reais

### Backend (apps/backend/package.json)

```json
{
  "dependencies": {
    "@nestjs/common": "^11.1.14",
    "@nestjs/config": "^4.0.3",
    "@nestjs/core": "^11.1.14",
    "@nestjs/event-emitter": "^3.0.1",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^11.1.14",
    "@nestjs/platform-socket.io": "^11.1.14",
    "@nestjs/schedule": "^6.1.1",
    "@nestjs/serve-static": "^5.0.4",
    "@nestjs/throttler": "^6.5.0",
    "@nestjs/websockets": "^11.1.14",
    "@prisma/client": "6.19.2",
    "@sentry/node": "^8.55.0",
    "@socket.io/redis-adapter": "^8.3.0",
    "adm-zip": "^0.5.16",
    "bcrypt": "^6.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.4",
    "cookie-parser": "^1.4.7",
    "cron": "^4.4.0",
    "express": "^5.2.1",
    "googleapis": "^171.3.0",
    "helmet": "^8.1.0",
    "ioredis": "^5.10.0",
    "multer": "^2.1.1",
    "nodemailer": "^7.0.13",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pg": "^8.19.0",
    "puppeteer": "^24.37.5",
    "qrcode": "^1.5.4",
    "redis": "^5.11.0",
    "rxjs": "^7.8.2",
    "sanitize-html": "^2.17.1",
    "semver": "^7.7.4",
    "socket.io": "^4.8.3",
    "speakeasy": "^2.0.0",
    "uuid": "^8.3.2",
    "web-push": "^3.6.7"
  }
}
```

### Frontend (apps/frontend/package.json)

```json
{
  "dependencies": {
    "@mui/material": "^7.3.8",
    "@mui/icons-material": "^7.3.8",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toast": "^1.2.15",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@sentry/nextjs": "^10.40.0",
    "@tiptap/react": "^3.20.0",
    "@tiptap/starter-kit": "^3.20.0",
    "axios": "^1.13.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "date-fns-tz": "^3.2.0",
    "html2pdf.js": "^0.14.0",
    "lucide-react": "^0.563.0",
    "next": "^16.1.7",
    "next-themes": "^0.4.6",
    "qrcode.react": "^4.2.0",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-grid-layout": "^2.2.2",
    "recharts": "^3.8.0",
    "rrule": "^2.8.1",
    "socket.io-client": "^4.8.3",
    "tailwind-merge": "^2.6.1",
    "zustand": "^5.0.11"
  }
}
```

---

## Estrutura Real

### Backend (apps/backend/src/)
```
app.module.ts           main.ts
audit/                  auth/
backup/                 common/
core/                   dashboard/
diagnostics/            email/
health/                 maintenance/
modules/                notifications/
prisma-seed/            retention/
security/               security-config/
security-regression/    system-settings/
tenants/                update/
users/
```

### Frontend (apps/frontend/src/)
```
app/                    components/
contexts/               core/
hooks/                  lib/
modules/                providers/
services/               test/
theme/                  traducoes/
types/
```

### Raiz do Projeto
```
apps/
  backend/              API NestJS
  frontend/             Next.js
DOCS/                   Documentacao
Scripts/                Scripts auxiliares
install/                Scripts de instalacao
docker-compose.*.yml    Configuracoes Docker
package.json            Workspace root (pnpm)
pnpm-workspace.yaml     Configuracao workspace
```

---

## Princios de Desenvolvimento

### SOLID
- Single Responsibility: cada service uma responsabilidade
- Dependency Injection: construtores do NestJS
- Open/Closed: extender, nao modificar

### Clean Code
- Nomes descritivos e em ingles
- Funcoes pequenas e focadas
- Constantes em `apps/backend/src/common/constants/`

### DRY
- Reutilizar guards, interceptors e decorators do core
- Utilitarios compartilhados em `core/common/utils/`

### KISS
- Simples antes de complexo

---

## Regras de Seguranca

### 1. Entradas
```typescript
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### 2. Excecoes
```typescript
try {
  const user = await this.userService.create(userData);
  return { success: true, user };
} catch (error) {
  this.logger.error('Failed to create user:', error);
  throw new HttpException('Erro ao criar usuario', HttpStatus.INTERNAL_SERVER_ERROR);
}
```

### 3. Prisma
Prisma usa prepared statements. Sempre filtrar por `tenantId`.

### 4. Dados Sensíveis
- NUNCA expor senhas em responses
- Hash com `bcrypt.hash(password, 10)`
- Logs NUNCA com senhas, tokens ou chaves

### 5. Auth/Autorizacao
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController { }
```

### 6. Raw SQL
Preferir `$queryRaw` com `Prisma.sql` tagged templates sobre `$queryRawUnsafe`:
```typescript
// Preferido
const results = await this.prisma.$queryRaw(
  Prisma.sql`SELECT * FROM tabela WHERE tenant_id = ${tenantId}`
);
// Funcional mas menos seguro
const results = await this.prisma.$queryRawUnsafe(
  `SELECT * FROM tabela WHERE tenant_id = $1`, tenantId
);
```

---

## Proibicoes

### NUNCA
- Senhas/chaves/tokens hardcoded no codigo
- Dados sensiveis em logs ou console.log
- `eval()` ou `Function()` com input do usuario
- `any` como tipo (usar tipos especificos)
- Alterar arquivos em `core/` para criar modulos

### Sempre
- Variaveis de ambiente (`process.env.*`)
- Exemplos ficticios para documentacao
- Placeholders como `YOUR_TOKEN_HERE`
- `pnpm` como gerenciador de pacotes

---

## Comandos

```bash
# Desenvolvimento
pnpm dev:backend
pnpm dev:frontend

# Build
pnpm build:all

# Prisma
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma migrate dev --name nome
pnpm --filter backend exec prisma migrate deploy
pnpm --filter backend exec prisma studio

# Testes
pnpm --filter backend test
pnpm --filter backend test:e2e

# Lint
pnpm --filter backend lint
pnpm --filter frontend lint
pnpm check:theming

# CI local
pnpm ci:local

# Seguranca
pnpm --filter backend run security:guardrails
pnpm --filter backend run test:security-regression

# Versionamento
pnpm release
pnpm versao

# Docker
docker compose -f docker-compose.dev.yml up --build -d
docker compose --env-file install/.env.production -f docker-compose.prod.yml up -d
```

---

## Checklist

Antes de implementar:
- [ ] Explicar o que o codigo faz
- [ ] Seguir SOLID
- [ ] Simplicidade (KISS)
- [ ] Evitar repeticao (DRY)
- [ ] Sanitizar entradas (DTOs)
- [ ] Tratar excecoes
- [ ] Verificar auth/authz
- [ ] Consistencia com codigo existente
- [ ] Usar `pnpm` para comandos

### Perguntas obrigatorias:
1. "Posso fazer de forma mais simples?"
2. "Este codigo esta seguro?"
3. "Estou seguindo os padroes?"
4. "E reutilizavel?"

---

## Referencias

- [NestJS](https://docs.nestjs.com/)
- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/)
- [MUI](https://mui.com/)
