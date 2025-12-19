# 🔧 CORREÇÃO: Rotas dos Módulos (404)

## ❌ Problema

Ao tentar acessar páginas dos módulos, aparece erro 404:
- `/modules/sistema/dashboard` → 404
- `/modules/sistema/notificacao` → 404  
- `/modules/sistema/ajustes` → 404

## 🔍 Causa Raiz

O arquivo `frontend/src/modules/registry.ts` estava **vazio**, com `modulePages = {}`.

A rota dinâmica `frontend/src/app/modules/[module]/[...slug]/page.tsx` tenta resolver componentes via `resolveModuleComponent()`, mas como o registry estava vazio, sempre retornava erro.

## ✅ Solução Implementada

### 1. Populei o Module Pages Registry

**Arquivo**: `frontend/src/modules/registry.ts`

```typescript
export const modulePages: Record<string, Record<string, () => Promise<any>>> = {
  // Módulo Sistema
  sistema: {
    '/dashboard': () => import('../../../modules/sistema/frontend/pages/dashboard'),
    '/notificacao': () => import('../../../modules/sistema/frontend/pages/notificacao'),
    '/ajustes': () => import('../../../modules/sistema/frontend/pages/ajustes'),
  }
};
```

### 2. Adicionei Logs de Debug

```typescript
console.log('🔍 [ModuleRegistry] Resolvendo componente:', { moduleSlug, route });
console.log('📚 [ModuleRegistry] Módulos disponíveis:', Object.keys(modulePages));
console.log('📝 [ModuleRegistry] Rotas disponíveis:', Object.keys(modulePagesMap));
console.log('✅ [ModuleRegistry] Carregando página:', `${moduleSlug}${route}`);
```

## 🧪 Como Testar

### 1. Fazer Hard Refresh
```bash
Ctrl + Shift + R
```

### 2. Acessar as Rotas

#### Opção 1: Via Menu Lateral
- Clique em "Sistema" na sidebar
- Clique em "Dashboard", "Notificações" ou "Ajustes"

#### Opção 2: Via URL Direta
```
http://localhost:3000/modules/sistema/dashboard
http://localhost:3000/modules/sistema/notificacao
http://localhost:3000/modules/sistema/ajustes
```

### 3. Verificar Console (F12)

**Logs Esperados**:
```
🔍 [ModuleRegistry] Resolvendo componente: { moduleSlug: 'sistema', route: '/dashboard' }
📚 [ModuleRegistry] Módulos disponíveis: ['sistema']
📝 [ModuleRegistry] Rotas disponíveis: ['/dashboard', '/notificacao', '/ajustes']
✅ [ModuleRegistry] Carregando página: sistema/dashboard
✅ [ModuleRegistry] Página carregada com sucesso
```

### 4. Verificar Visual

**Dashboard** (`/modules/sistema/dashboard`):
```
┌────────────────────────────────┐
│ Dashboard do Sistema           │
│                                │
│ [Componente SistemaDashboard]  │
└────────────────────────────────┘
```

**Notificações** (`/modules/sistema/notificacao`):
```
┌────────────────────────────────┐
│ Notificações                   │
│                                │
│ Seu conteúdo vai aqui          │
└────────────────────────────────┘
```

**Ajustes** (`/modules/sistema/ajustes`):
```
┌────────────────────────────────┐
│ Ajustes                        │
│                                │
│ Seu conteúdo vai aqui          │
└────────────────────────────────┘
```

## 🔍 Troubleshooting

### Ainda aparece 404?

**1. Verificar se módulo está registrado**:
```javascript
// No console do navegador
import('../../../modules/sistema/frontend/pages/dashboard')
  .then(m => console.log('✅ Import funciona:', m))
  .catch(e => console.error('❌ Erro no import:', e))
```

**2. Possível Erro: Next.js bloqueia imports externos**

Se o Next.js bloquear imports de `../../../modules/`, você verá:
```
Module not found: Can't resolve '../../../modules/sistema/...'
```

**Solução Alternativa**: Copiar páginas para dentro do frontend.

### Erro de compilação?

Se aparecer erro de compilação do Next.js, pode ser que ele não permite imports de fora da pasta `frontend/`.

**Soluções**:

#### Opção A: Configurar next.config.js
```javascript
// next.config.js
module.exports = {
  experimental: {
    externalDir: true
  }
}
```

#### Opção B: Criar Symlink (não recomendado)

#### Opção C: Copiar páginas para frontend
```bash
# Criar mirror das páginas dentro do frontend
frontend/src/modules/sistema/pages/
  - dashboard.tsx
  - notificacao.tsx
  - ajustes.tsx
```

#### Opção D: API Route Proxy (recomendado para produção)
Criar API que serve componentes renderizados.

## 📊 Estrutura de Rotas

### Rota Dinâmica do Next.js

```
frontend/src/app/modules/[module]/[...slug]/page.tsx
                          ↓         ↓
                      moduleSlug   route
```

### Exemplos de Mapeamento

| URL | moduleSlug | slug | route |
|-----|------------|------|-------|
| `/modules/sistema/dashboard` | `sistema` | `['dashboard']` | `/dashboard` |
| `/modules/sistema/notificacao` | `sistema` | `['notificacao']` | `/notificacao` |
| `/modules/sistema/ajustes` | `sistema` | `['ajustes']` | `/ajustes` |

### Fluxo de Resolução

```
1. Usuário acessa: /modules/sistema/dashboard
                              ↓
2. Next.js Match: [module]/[...slug]/page.tsx
   - module = 'sistema'
   - slug = ['dashboard']
                              ↓
3. page.tsx chama: resolveModuleComponent('sistema', '/dashboard')
                              ↓
4. Registry busca: modulePages['sistema']['/dashboard']
                              ↓
5. Import dinâmico: import('../../../modules/sistema/frontend/pages/dashboard')
                              ↓
6. Renderiza: <Component />
```

## ⚠️ Limitação Conhecida

O Next.js **pode bloquear** imports de fora da pasta `frontend/` por questões de segurança.

Se isso acontecer, teremos que implementar uma das soluções alternativas mencionadas acima.

## ✅ Status Atual

- [x] Registry populado com páginas do módulo sistema
- [x] Logs de debug adicionados
- [x] Imports configurados (caminho relativo correto)
- [ ] **Aguardando teste** - verificar se Next.js permite imports externos

## 🚀 Próximos Passos

### Se Funcionar ✅
1. Documentar como adicionar novos módulos
2. Criar script para auto-registro
3. Adicionar mais páginas

### Se NÃO Funcionar ❌
1. Implementar solução alternativa (Opção A ou D)
2. Mover páginas para dentro do frontend
3. Ou usar API route proxy

## 📝 Teste Rápido

Execute no console do navegador:
```javascript
// Testar se o registry está populado
import('@/modules/registry').then(r => {
  console.log('Módulos:', Object.keys(r.modulePages));
  console.log('Rotas sistema:', Object.keys(r.modulePages.sistema || {}));
})
```

**Resultado Esperado**:
```
Módulos: ['sistema']
Rotas sistema: ['/dashboard', '/notificacao', '/ajustes']
```
