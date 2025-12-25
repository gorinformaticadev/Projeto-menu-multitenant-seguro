# 📐 CONVENÇÃO OFICIAL - Estrutura de Módulos (DEFINITIVA)

## 🎯 Princípio Fundamental

**O sistema é 100% dinâmico e baseado no banco de dados.**

- ✅ O banco define quais módulos existem
- ✅ O banco define quais rotas existem
- ✅ O loader resolve dinamicamente onde está o código
- ❌ ZERO edição manual de código para novos módulos

## 📂 Estrutura Física Obrigatória

```
packages/
└─ modules/
   └─ {moduleSlug}/
      ├─ module.json          # Metadados do módulo
      ├─ backend/             # Código backend (opcional)
      ├─ frontend/            # Código frontend (opcional)
      │  └─ pages/            # ⚠️ PÁGINAS DO MÓDULO
      │     ├─ {route-slug}/
      │     │  └─ page.tsx    # ✅ CONVENÇÃO OBRIGATÓRIA
      │     ├─ {route-slug}/
      │     │  └─ page.tsx
      │     └─ {route-slug}/
      │        └─ page.tsx
      ├─ migrations/          # Migrations SQL (opcional)
      └─ seeds/               # Seeds SQL (opcional)
```

### ⚠️ IMPORTANTE: Estrutura de Páginas

**✅ CORRETO:**
```
packages/modules/sistema/frontend/pages/model-notification/page.tsx
packages/modules/sistema/frontend/pages/dashboard/page.tsx
packages/modules/sistema/frontend/pages/ajustes/page.tsx
```

**❌ ERRADO:**
```
packages/modules/sistema/frontend/pages/modelNotification.tsx
packages/modules/sistema/frontend/pages/model-notification.tsx
packages/modules/sistema/frontend/pages/dashboard.tsx
```

## 🗄️ Configuração no module.json

### Exemplo Completo

```json
{
  "name": "sistema",
  "displayName": "Sistema",
  "version": "1.0.1",
  "description": "Módulo de sistema",
  "menus": [
    {
      "label": "Dashboard",
      "route": "/modules/sistema/dashboard",
      "icon": "Activity",
      "order": 1
    },
    {
      "label": "Notificações",
      "route": "/modules/sistema/model-notification",
      "icon": "Bell",
      "order": 2
    },
    {
      "label": "Ajustes",
      "route": "/modules/sistema/ajustes",
      "icon": "Settings",
      "order": 3
    }
  ]
}
```

### Regras para `route`

1. **Formato obrigatório:** `/modules/{moduleSlug}/{route-slug}`
2. **moduleSlug:** Nome da pasta do módulo (lowercase)
3. **route-slug:** Nome do diretório da página (kebab-case)

**✅ CORRETO:**
```json
{
  "route": "/modules/sistema/model-notification"
}
```
Estrutura: `packages/modules/sistema/frontend/pages/model-notification/page.tsx`

**❌ ERRADO:**
```json
{
  "route": "/modules/sistema/modelNotification"  // ❌ camelCase não é permitido
}
```

## 📄 Estrutura de Arquivo de Página

### Localização Obrigatória

```
packages/modules/{moduleSlug}/frontend/pages/{route-slug}/page.tsx
```

### Template Obrigatório

```typescript
"use client";

import React from 'react';

/**
 * Página: {Nome da Página}
 * Módulo: {moduleSlug}
 * Rota: /modules/{moduleSlug}/{route-slug}
 */
export default function Page() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Título da Página</h1>
            {/* Conteúdo da página */}
        </div>
    );
}
```

**⚠️ REGRAS OBRIGATÓRIAS:**
- ✅ Arquivo DEVE se chamar `page.tsx`
- ✅ DEVE estar dentro de um diretório com nome da rota
- ✅ DEVE exportar `export default`
- ✅ DEVE usar `"use client"` no topo
- ✅ Nome da função pode ser qualquer um

## 🔄 Fluxo de Resolução

### 1. URL Acessada

```
https://app.com/modules/sistema/model-notification
```

### 2. Next.js Extrai Parâmetros

```typescript
params.module = "sistema"
params.slug = ["model-notification"]
```

### 3. Loader Monta Caminho

```typescript
const route = slug.join('/');  // "model-notification"
const path = `@modules/sistema/frontend/pages/model-notification/page`;
```

### 4. Import Dinâmico

```typescript
const module = await import(`@modules/sistema/frontend/pages/model-notification/page`);
```

### 5. Componente Renderizado

```typescript
const Component = module.default;
return <Component />;
```

## ✅ Exemplos Corretos

### Exemplo 1: Página Simples

**URL:** `/modules/sistema/dashboard`

**module.json:**
```json
{
  "menus": [
    {
      "label": "Dashboard",
      "route": "/modules/sistema/dashboard",
      "icon": "Activity"
    }
  ]
}
```

**Estrutura:**
```
packages/modules/sistema/frontend/pages/dashboard/page.tsx
```

**Código:**
```typescript
"use client";

export default function DashboardPage() {
    return <div>Dashboard do Sistema</div>;
}
```

### Exemplo 2: Página com Nome Composto

**URL:** `/modules/sistema/model-notification`

**module.json:**
```json
{
  "menus": [
    {
      "label": "Notificações",
      "route": "/modules/sistema/model-notification",
      "icon": "Bell"
    }
  ]
}
```

**Estrutura:**
```
packages/modules/sistema/frontend/pages/model-notification/page.tsx
```

**Código:**
```typescript
"use client";

export default function ModelNotificationPage() {
    return <div>Modelo de Notificações</div>;
}
```

### Exemplo 3: Página Aninhada

**URL:** `/modules/financeiro/relatorios/vendas`

**module.json:**
```json
{
  "menus": [
    {
      "label": "Relatório de Vendas",
      "route": "/modules/financeiro/relatorios/vendas",
      "icon": "FileText"
    }
  ]
}
```

**Estrutura:**
```
packages/modules/financeiro/frontend/pages/relatorios/vendas/page.tsx
```

## ❌ Erros Comuns

### Erro 1: Arquivo fora do diretório

**❌ ERRADO:**
```
packages/modules/sistema/frontend/pages/dashboard.tsx
```

**✅ CORRETO:**
```
packages/modules/sistema/frontend/pages/dashboard/page.tsx
```

### Erro 2: Nome de arquivo incorreto

**❌ ERRADO:**
```
packages/modules/sistema/frontend/pages/dashboard/index.tsx
packages/modules/sistema/frontend/pages/dashboard/Dashboard.tsx
```

**✅ CORRETO:**
```
packages/modules/sistema/frontend/pages/dashboard/page.tsx
```

### Erro 3: Usar camelCase na rota

**❌ ERRADO:**
```json
{ "route": "/modules/sistema/modelNotification" }
```

**✅ CORRETO:**
```json
{ "route": "/modules/sistema/model-notification" }
```

### Erro 4: Não exportar default

**❌ ERRADO:**
```typescript
export function MyPage() {
    return <div>Conteúdo</div>;
}
```

**✅ CORRETO:**
```typescript
export default function MyPage() {
    return <div>Conteúdo</div>;
}
```

## 🔧 Checklist para Novo Módulo

Ao criar um novo módulo:

- [ ] Criar pasta `packages/modules/{moduleSlug}/`
- [ ] Criar `module.json` com rotas em kebab-case
- [ ] Para cada rota, criar diretório: `frontend/pages/{route-slug}/`
- [ ] Dentro de cada diretório, criar `page.tsx`
- [ ] Cada `page.tsx` exporta `export default`
- [ ] Cada `page.tsx` tem `"use client"` no topo
- [ ] Instalar módulo via instalador (cria registros no banco)
- [ ] Testar navegação

**✅ NENHUMA edição manual no frontend é necessária!**

## 📊 Resumo da Convenção

| Elemento | Formato | Exemplo |
|----------|---------|---------|
| **Slug do Módulo** | lowercase | `sistema` |
| **Rota no menu** | `/modules/{moduleSlug}/{route-slug}` | `/modules/sistema/model-notification` |
| **Diretório da página** | kebab-case | `model-notification/` |
| **Arquivo da página** | `page.tsx` | `page.tsx` |
| **Caminho completo** | `packages/modules/{moduleSlug}/frontend/pages/{route-slug}/page.tsx` | `packages/modules/sistema/frontend/pages/model-notification/page.tsx` |
| **Export** | `export default` | `export default function Page() {}` |

## 🎯 Princípios Inegociáveis

1. **Sem conversões automáticas**
   - Não há conversão camelCase ↔ kebab-case
   - O que está no banco é o que será usado

2. **Sem fallbacks**
   - Não tenta múltiplos caminhos
   - Não adivinha nomes de arquivo
   - Falha rápido e claro

3. **Convenção única**
   - Sempre `{route-slug}/page.tsx`
   - Nunca `{route-slug}.tsx`
   - Nunca `{route-slug}/index.tsx`

4. **100% dinâmico**
   - Banco define módulos
   - Banco define rotas
   - Loader resolve automaticamente
   - Zero edição manual

---

**Versão:** 2.0 (DEFINITIVA)  
**Data:** 2025-12-25  
**Status:** ✅ OFICIAL E OBRIGATÓRIA  
**Mudanças:** Estrutura `{route}/page.tsx` obrigatória
