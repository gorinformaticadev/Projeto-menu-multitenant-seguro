# Regras de Desenvolvimento para IA

## Visao Geral do Projeto

Sistema Multitenant Seguro full-stack com isolamento de dados e controle de acesso baseado em roles (RBAC).

### Arquitetura
- **Backend:** NestJS com TypeScript (pnpm workspace)
- **Frontend:** Next.js com React e TypeScript
- **Banco de Dados:** PostgreSQL com Prisma ORM
- **Autenticacao:** JWT + 2FA (TOTP)
- **Estilizacao:** Tailwind CSS + Radix UI
- **Monitoramento:** Sentry
- **Pacotes:** pnpm (monorepo workspace)

---

## Stack Tecnologica

### Backend (NestJS)
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`
- `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`
- `@prisma/client`, `prisma`
- `@nestjs/throttler`, `helmet`, `class-validator`, `class-transformer`
- `nodemailer`, `speakeasy`, `qrcode`
- `@sentry/node`, `uuid`, `multer`, `cookie-parser`, `socket.io`

### Frontend (Next.js)
- `next`, `react`, `react-dom`
- `@radix-ui/*`, `lucide-react`, `tailwindcss`
- `axios`
- `clsx`, `class-variance-authority`, `tailwind-merge`
- `@sentry/nextjs`, `next-themes`

### Banco de Dados
- **PostgreSQL** (producao)
- **Prisma ORM** (migrations, queries, schema)
- **Redis** (cache/sessions)

---

## Principios de Desenvolvimento

### 1. SOLID Principles
- Single Responsibility: cada classe/funcao uma responsabilidade
- Dependency Injection: usar construtores do NestJS
- Open/Closed: extender, nao modificar

### 2. Clean Code
- Nomes descritivos e em ingles
- Funcoes pequenas e focadas
- Evitar magic numbers (usar constantes)

### 3. DRY
- Reutilizar logica comum via services e guards do core
- Usar constantes definidas em `apps/backend/src/common/constants/`

### 4. KISS
- Simples e direto antes de complexo
- Premature optimization e raiz de todos os males

---

## Regras de Seguranca (OBRIGATORIAS)

### 1. Sanitizacao de Entradas
```typescript
// Sempre usar DTOs com validacao
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### 2. Tratamento de Excecoes
```typescript
try {
  const user = await this.userService.create(userData);
  return { success: true, user };
} catch (error) {
  this.logger.error('Failed to create user:', error);
  throw new HttpException('Erro ao criar usuario', HttpStatus.INTERNAL_SERVER_ERROR);
}
```

### 3. Prisma (Prepared Statements)
Prisma ja usa prepared statements automaticamente. Sempre passar `tenantId` nos filtros.

### 4. Protecao de Densiveis
- NUNCA expor senhas em responses
- Hash de senhas com `bcrypt.hash(password, 10)`
- Logs NUNCA devem conter senhas, tokens ou chaves

### 5. Autenticacao e Autorizacao
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController { }
```

---

## Proibicoes Absolutas

### NUNCA Fazer:
- Senhas reais hardcoded
- Chaves de API reais no codigo
- Tokens JWT hardcoded
- Dados sensiveis em logs ou console.log
- `eval()` ou `Function()` com input do usuario
- `any` como tipo (usar tipos especificos)

### Sempre Usar:
- Variaveis de ambiente (`process.env.*`)
- Exemplos ficticios para documentacao
- Placeholders como `YOUR_TOKEN_HERE`

---

## Estrutura de Arquivos

### Monorepo (pnpm workspace)
```
apps/
  backend/          # API NestJS
    src/
      auth/         # Autenticacao
      users/        # Gestao de usuarios
      tenants/      # Isolamento multitenant
      security-config/ # Configuracoes de seguranca
      common/       # Guards, interceptors, decorators, constants
      modules/      # Modulos dinamicos (instalados via ZIP)
      prisma/       # Modulo Prisma
      core/         # Infraestrutura de modulos
    prisma/
      schema.prisma # Schema do banco
      migrations/   # Migrations versionadas
  frontend/         # Next.js
    src/
      app/          # App Router
      components/   # Componentes React
      contexts/     # Contextos
      hooks/        # Hooks customizados
      lib/          # Utilitarios (api, utils)
      theme/        # Sistema de temas
DOCS/               # Documentacao tecnica
Scripts/            # Scripts auxiliares
install/            # Scripts de instalacao
```

---

## Regras de Comentarios

### Backend (TypeScript)
```typescript
/**
 * Servico de autenticacao
 * Implementa JWT + 2FA com isolamento multitenant
 */
@Injectable()
export class AuthService {
  /**
   * Realiza login do usuario
   * @param email - Email do usuario
   * @param password - Senha em texto plano
   * @returns Tokens de acesso
   */
  async login(email: string, password: string): Promise<LoginResult> {
    // Buscar usuario por email
    const user = await this.findUserByEmail(email);
    // ...
  }
}
```

### Frontend (React/TypeScript)
```typescript
/**
 * Hook para gerenciar configuracoes da plataforma
 */
export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_CONFIG);
  // ...
}
```

---

## Estrategia de Desenvolvimento

### 1. Comecar Simples
Primeiro o esqueleto basico, depois adicionar funcionalidades.

### 2. Modularidade
Separar responsabilidades em modulos NestJS distintos.

### 3. Performance
- Evitar N+1 queries (usar `include` do Prisma)
- Usar indices no banco
- Cache com Redis quando apropriado

---

## Comandos Uteis

```bash
# Desenvolvimento
pnpm dev:backend
pnpm dev:frontend

# Build
pnpm build:all

# Prisma
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma migrate dev --name nome

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
```

---

## Checklist de Desenvolvimento

Antes de implementar qualquer codigo:
- [ ] Explicar o que o codigo faz
- [ ] Verificar se segue principios SOLID
- [ ] Garantir simplicidade (KISS)
- [ ] Evitar repeticao (DRY)
- [ ] Implementar sanitizacao de entradas
- [ ] Adicionar tratamento de excecoes
- [ ] Verificar seguranca (auth/authz)
- [ ] Manter consistencia com codigo existente
- [ ] Usar `pnpm` para todos os comandos

### Perguntas obrigatorias antes de codificar:
1. "Posso fazer isso de forma mais simples?"
2. "Este codigo esta seguro?"
3. "Estou seguindo os padroes do projeto?"
4. "Este codigo e reutilizavel?"

---

## Referencias

- [NestJS](https://docs.nestjs.com/)
- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

Consulte `DOCS/` para documentacao tecnica especifica.
