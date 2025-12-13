# 📜 Regras para Criação de Módulos

## 🎯 Objetivo

Este documento define as regras e diretrizes para a criação de módulos no sistema modular. Todos os módulos devem seguir estas regras para garantir compatibilidade, segurança e manutenibilidade.

## ⚠️ PRINCÍPIO FUNDAMENTAL: NÃO ALTERAR O CORE

**ABSOLUTAMENTE NADA NO CORE DEVE SER MODIFICADO DURANTE A CRIAÇÃO DE MÓDULOS.**

- **NÃO** modifique arquivos no diretório `/core`
- **NÃO** altere estruturas do banco de dados principais
- **NÃO** modifique componentes centrais do sistema
- **NÃO** altere arquivos de configuração do core
- **NÃO** modifique o Module Engine

Todo o desenvolvimento de módulos deve ser feito exclusivamente no diretório `/modules`.

## 📁 Estrutura Obrigatória do Módulo

Cada módulo deve seguir exatamente esta estrutura de diretórios:

```
/modules/
└── <nome-do-modulo>/
    ├── module.config.json          # Configuração do módulo (OBRIGATÓRIO)
    ├── backend/                    # Backend do módulo
    │   ├── controllers/            # Controladores NestJS
    │   ├── services/               # Serviços NestJS
    │   ├── prisma/                # Schema e migrations Prisma específicas
    │   ├── routes.ts              # Rotas do módulo
    │   ├── permissions.ts         # Permissões específicas do módulo
    │   ├── events.ts              # Eventos e listeners
    │   └── index.ts               # Ponto de entrada do backend
    ├── frontend/                  # Frontend do módulo
    │   ├── pages/                 # Páginas Next.js
    │   ├── components/            # Componentes React
    │   ├── hooks/                 # Hooks personalizados
    │   ├── menu.ts               # Configuração do menu
    │   ├── notifications.ts      # Configuração de notificações
    │   └── index.ts              # Ponto de entrada do frontend
    └── integrations/              # Integrações externas
        ├── triggers/              # Gatilhos automatizados
        ├── listeners/             # Escutas de eventos
        └── api-extensions.ts     # Extensões de API
```

## 📄 Arquivo module.config.json (OBRIGATÓRIO)

Todo módulo **DEVE** ter um arquivo `module.config.json` na raiz com esta estrutura:

```json
{
  "name": "nome-do-modulo",
  "displayName": "Nome Amigável do Módulo",
  "description": "Descrição detalhada do que o módulo faz",
  "version": "1.0.0",
  "author": "Nome do Autor",
  "dependencies": {
    "coreVersion": "^1.0.0",
    "otherModules": []
  },
  "permissions": [
    {
      "name": "modulo.ver",
      "description": "Permite visualizar o módulo"
    },
    {
      "name": "modulo.editar",
      "description": "Permite editar dados do módulo"
    },
    {
      "name": "modulo.administrar",
      "description": "Permite administrar o módulo"
    }
  ],
  "routes": [
    {
      "path": "/modulo",
      "permission": "modulo.ver"
    }
  ],
  "menu": {
    "enabled": true,
    "position": 100,
    "icon": "Package",
    "label": "Nome do Módulo"
  }
}
```

## 🏗️ Backend - Requisitos Obrigatórios

### 1. Estrutura de Controllers
```typescript
// backend/controllers/*.controller.ts
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/core/backend/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/backend/common/guards/roles.guard';

@Controller('modulo-nome')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModuloNomeController {
  // Implementação
}
```

### 2. Services
```typescript
// backend/services/*.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/backend/prisma/prisma.service';

@Injectable()
export class ModuloNomeService {
  constructor(private prisma: PrismaService) {}
  
  // Implementação
}
```

### 3. Rotas
```typescript
// backend/routes.ts
import { ModuloNomeController } from './controllers/modulo-nome.controller';

export const routes = [
  {
    path: 'modulo-nome',
    controller: ModuloNomeController,
  },
];
```

### 4. Permissões
```typescript
// backend/permissions.ts
export const permissions = [
  {
    name: 'modulo-nome.view',
    description: 'Visualizar módulo Nome',
  },
  {
    name: 'modulo-nome.manage',
    description: 'Gerenciar módulo Nome',
  },
];
```

## 🎨 Frontend - Requisitos Obrigatórios

### 1. Estrutura de Páginas
```typescript
// frontend/pages/*.tsx
"use client";

import { useModulePermissions } from '@/core/frontend/hooks/use-module-permissions';

export default function ModuloPage() {
  const { hasPermission } = useModulePermissions('modulo-nome');
  
  if (!hasPermission('modulo-nome.view')) {
    return <div>Sem permissão para acessar este módulo</div>;
  }
  
  return (
    <div>
      {/* Conteúdo do módulo */}
    </div>
  );
}
```

### 2. Menu
```typescript
// frontend/menu.ts
export const menu = {
  name: 'modulo-nome',
  label: 'Nome do Módulo',
  icon: 'Package',
  path: '/modulo-nome',
  permission: 'modulo-nome.view',
  position: 100,
};
```

### 3. Notificações
```typescript
// frontend/notifications.ts
export const notifications = {
  events: [
    {
      name: 'modulo-nome.created',
      title: 'Módulo criado',
      message: 'Um novo item foi criado no módulo Nome',
    },
  ],
};
```

## 🔌 Integrações - Requisitos Obrigatórios

### 1. Eventos
```typescript
// integrations/events.ts
export const events = {
  triggers: [
    {
      event: 'user.created',
      handler: 'handleUserCreated',
    },
  ],
  listeners: [
    {
      event: 'modulo-nome.item.created',
      action: 'sendNotification',
    },
  ],
};
```

## 🛡️ Regras de Segurança

### 1. Isolamento por Tenant
- Todo dado deve ser filtrado automaticamente pelo `tenantId`
- NUNCA acesse dados de outros tenants sem permissão explícita
- Use os guards e interceptors do core

### 2. Permissões
- SEMPRE verifique permissões antes de executar ações
- Use o sistema RBAC integrado do core
- NÃO crie sistemas de permissão paralelos

### 3. Validação de Dados
- SEMPRE valide entradas usando DTOs
- Use os validators do core
- NÃO confie em dados vindos do frontend

## 📊 Banco de Dados

### 1. Migrations Prisma
- Crie migrations específicas do módulo em `backend/prisma/migrations/`
- NÃO modifique schemas principais do core
- Use prefixos claros para tabelas do módulo

### 2. Models
```prisma
// backend/prisma/schema.prisma
model ModuloNomeItem {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  name      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@index([tenantId])
  @@map("modulo_nome_items")
}
```

## 🔄 Compatibilidade

### 1. Versões
- SEMPRE declare a versão mínima do core necessária
- Siga versionamento semântico (SemVer)
- Teste compatibilidade antes de releases

### 2. Dependências
- Liste todas as dependências de outros módulos
- Evite dependências cíclicas
- Declare versões compatíveis

## ✅ Checklist de Validação

Antes de considerar um módulo pronto, verifique:

### Estrutura
- [ ] Diretório `/modules/<nome>` criado
- [ ] `module.config.json` presente e válido
- [ ] Estrutura de backend/frontend/integrations correta

### Backend
- [ ] Controllers usando guards do core
- [ ] Services injetando PrismaService do core
- [ ] Rotas registradas corretamente
- [ ] Permissões definidas

### Frontend
- [ ] Páginas usando hooks do core
- [ ] Menu configurado
- [ ] Notificações definidas

### Segurança
- [ ] Isolamento por tenant implementado
- [ ] Permissões verificadas
- [ ] Validação de dados presente

### Banco de Dados
- [ ] Migrations criadas
- [ ] Models com tenantId
- [ ] Índices apropriados

## 🚫 Coisas Proibidas

### ABSOLUTAMENTE PROIBIDO:
- Modificar qualquer arquivo no `/core`
- Acessar diretamente tabelas do core sem permissão
- Criar endpoints que ignorem tenant isolation
- Modificar schemas principais do banco
- Criar sistemas de autenticação paralelos
- Acessar dados de outros tenants sem autorização
- Modificar configurações globais do sistema

## 🎯 Boas Práticas

1. **Mantenha módulos coesos** - Cada módulo deve ter uma única responsabilidade clara
2. **Use APIs públicas** - Prefira métodos públicos do core em vez de acessar internals
3. **Documente tudo** - Crie documentação clara para seu módulo
4. **Teste extensivamente** - Teste em diferentes cenários de tenant
5. **Siga convenções** - Use os mesmos padrões do core
6. **Mantenha atualizações** - Acompanhe mudanças no core e adapte-se

## 📞 Suporte

Para dúvidas sobre criação de módulos:
- Consulte a documentação em `DOCS/`
- Verifique módulos de exemplo em `modules/sample-module/`


---

**Lembre-se: O objetivo é criar módulos plug-and-play que possam ser ativados/desativados por tenant sem afetar o funcionamento do core.**