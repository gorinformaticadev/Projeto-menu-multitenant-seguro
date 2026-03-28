# Regras para Criacao de Modulos

## Objetivo

Este documento define as regras para criar modulos compatíveis com o sistema modular do Pluggor. Todos os modulos devem seguir estas regras para garantir compatibilidade, seguranca e manutenibilidade.

## PRINCIPIO FUNDAMENTAL: NAO ALTERAR O CORE

- NAO modifique arquivos em `apps/backend/src/core/`
- NAO altere schemas principais do banco de dados
- NAO modifique componentes centrais do sistema
- NAO altere o Dynamic Modules Loader
- NAO modifique o Module Engine

Todo o desenvolvimento de modulos deve ser feito exclusivamente via ZIP upload ou dentro de `apps/backend/src/modules/{slug}/` e `apps/frontend/src/app/modules/{slug}/`.

## Estrutura do ZIP do Modulo

O modulo e distribuido como um ZIP com a seguinte estrutura:

```
modulo-nome/
├── module.json                  # Configuracao OBRIGATORIA
├── backend/
│   ├── modulo-nome.module.ts    # Entry point NestJS (OBRIGATORIO)
│   ├── controllers/
│   │   └── *.controller.ts
│   ├── services/
│   │   └── *.service.ts
│   ├── dto/
│   │   └── *.dto.ts
│   ├── migrations/              # SQL puro (OBRIGATORIO para criar tabelas)
│   │   └── 001_initial.sql
│   └── seeds/                   # SQL puro para dados iniciais
│       └── 001_seed.sql
└── frontend/
    ├── page.tsx                 # Pelo menos uma page.tsx (OBRIGATORIO)
    ├── dashboard/
    │   └── page.tsx
    ├── components/
    └── hooks/
```

## Arquivo module.json (OBRIGATORIO)

```json
{
  "name": "modulo-nome",
  "displayName": "Nome do Modulo",
  "version": "1.0.0",
  "description": "Descricao do modulo",
  "author": "Autor",
  "category": "utilidade",
  "dependencies": ["core-crm"],
  "npmDependencies": {
    "backend": {
      "axios": "^1.7.2"
    },
    "frontend": {
      "@tanstack/react-query": "^5.59.0"
    }
  },
  "menus": [
    {
      "label": "Dashboard",
      "route": "/modules/modulo-nome/dashboard",
      "icon": "LayoutDashboard",
      "order": 10,
      "permission": "modulo-nome.view"
    }
  ]
}
```

### Regras de validacao do module.json

- `name`: apenas `[a-zA-Z0-9_-]`, 2-50 caracteres, nao pode ser `node_modules`, `.env`, etc.
- `version`: formato semver `X.Y.Z` (OBRIGATORIO)
- `dependencies`: array de slugs de outros modulos
- `npmDependencies`: pacotes NPM separados por `backend` e `frontend`
  - Versoes inseguras sao bloqueadas: `latest`, `*`, `git:`, `file:`, `link:`, `workspace:`, `http:`, `https:`
  - Conflitos com o projeto resultam em status `dependency_conflict`

## Backend - Requisitos

### Entry Point (OBRIGATORIO)

O arquivo deve se chamar `{slug}.module.ts` e exportar uma classe NestJS Module:

```typescript
// backend/modulo-nome.module.ts
import { Module } from '@nestjs/common';
import { ModuloNomeController } from './controllers/modulo-nome.controller';
import { ModuloNomeService } from './services/modulo-nome.service';

@Module({
  controllers: [ModuloNomeController],
  providers: [ModuloNomeService],
  exports: [ModuloNomeService],
})
export class ModuloNomeModule {}
```

### Controllers

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/common/guards/roles.guard';

@Controller('modulo-nome')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModuloNomeController {
  // Implementacao
}
```

### Services

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ModuloNomeService {
  constructor(private prisma: PrismaService) {}
}
```

### Migrations (SQL Puro)

As migrations ficam em `backend/migrations/` e sao executadas via `POST /:slug/prepare-database`.

- Usar SQL puro (nao Prisma migrations)
- Cada arquivo e rastreado na tabela `module_migrations`
- Seeds devem usar `ON CONFLICT` ou `NOT EXISTS` para idempotencia

## Frontend - Requisitos

### Paginas

Pelo menos um `page.tsx` e obrigatorio. As paginas sao carregadas dinamicamente pelo App Router do Next.js:

```tsx
// frontend/page.tsx
"use client";

export default function ModuloNomePage() {
  return (
    <div>
      <h1>Modulo Nome</h1>
    </div>
  );
}
```

### Rotas

As paginas sao acessiveis em `/modules/{slug}/{caminho}`:
- `frontend/page.tsx` → `/modules/modulo-nome`
- `frontend/dashboard/page.tsx` → `/modules/modulo-nome/dashboard`

### Imagens e Uploads

Para upload de imagens, usar os utilitarios compartilhados do core:
- `createImageMulterOptions()` para configuracao do Multer
- `validateUploadedImageBuffer()` para validacao de buffer
- `PathsService` para resolucao de caminhos

Ver `DOCS/Modulo/GUIA_IMAGENS_UPLOAD_EXIBICAO.md` para detalhes.

## Ciclo de Vida do Modulo

```
detected → uploaded → pending_dependencies → dependencies_installed → ready → active
                                                                              ↓
                                                                           disabled
```

### Fluxo de instalacao

1. Upload do ZIP via API (`POST /configuracoes/sistema/modulos/upload`)
2. Validacao do ZIP (assinatura + estrutura)
3. Extracao e validacao do `module.json`
4. Distribuicao de arquivos:
   - `backend/*` → `apps/backend/src/modules/{slug}/`
   - `frontend/*` → `apps/frontend/src/app/modules/{slug}/`
5. Registro no banco (tabela `modules`)
6. Registro de menus (tabela `module_menus`)
7. Merge de dependencias NPM (`package.json`) + `pnpm install`
8. Preparacao do banco (`POST /:slug/prepare-database`) — migrations + seeds
9. Ativacao global (`POST /:slug/activate`)
10. Ativacao por tenant (`POST /tenants/:tenantId/modules/:slug`)

### Carregamento no Boot

O `DynamicModulesLoader` carrega modulos ativos automaticamente:
1. Consulta modulos com `status = 'active'` e `hasBackend = true`
2. Procura `apps/backend/src/modules/{slug}/{slug}.module.ts`
3. Carrega via `require()` e espera export `{Capitalize(slug)}Module`
4. Adiciona ao `imports[]` do AppModule via padrao dynamic module

## Seguranca

### Isolamento por Tenant
- Todo dado deve ser filtrado pelo `tenantId`
- Modulo so e executado se ativo E habilitado para o tenant
- Verificacao feita por `ModuleSecurityService.canExecuteModule(slug, tenantId)`

### Permissoes
- Definidas no campo `menus[].permission` do `module.json`
- Filtro por role: SUPER_ADMIN > ADMIN > USER > CLIENT
- Menus com permissao contendo "admin" sao ocultos para nao-admins

## Checklist de Validacao

- [ ] `module.json` presente e valido
- [ ] `version` em formato semver
- [ ] Entry point `{slug}.module.ts` no backend
- [ ] Pelo menos um `page.tsx` no frontend
- [ ] Migrations em `backend/migrations/` (SQL puro)
- [ ] Seeds idempotentes em `backend/seeds/`
- [ ] Dependencias NPM em `npmDependencies` (nao `package.json`)
- [ ] Menus com permissoes definidas
- [ ] Isolamento por tenant implementado

## Coisas Proibidas

- Modificar qualquer arquivo em `apps/backend/src/core/`
- Criar endpoints que ignorem tenant isolation
- Modificar schemas principais do banco
- Criar sistemas de autenticação paralelos
- Acessar dados de outros tenants sem autorização
- Usar `package.json` dentro do ZIP para dependencias NPM (use `npmDependencies` no `module.json`)
