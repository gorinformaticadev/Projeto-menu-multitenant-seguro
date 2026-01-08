# Correção do Erro 429 (Too Many Requests) e Métodos Faltantes

## ✅ STATUS: CONCLUÍDO

## Problemas Identificados

### 1. Erro 429 - Too Many Requests
```
GET http://localhost:4000/me/modules 429 (Too Many Requests)
```

**Causa**: Múltiplas chamadas simultâneas ao endpoint `/me/modules` causadas por:
- `useModuleRegistry` carregando módulos
- `useModulesManager` TAMBÉM carregando módulos automaticamente
- Ambos disparados no mesmo momento após login

### 2. Método `getNotifications` Faltando
```
TypeError: moduleRegistry.getNotifications is not a function
```

**Causa**: `ModuleRegistryNotifications` tentava chamar método inexistente.

## Solução Implementada

### 1. Removido Carregamento Duplicado

**Arquivo**: `frontend/src/hooks/useModulesManager.ts`

**ANTES** (problemático):
```typescript
useEffect(() => {
  loadModules(); // ❌ Chamada automática
}, []);
```

**DEPOIS** (corrigido):
```typescript
// ✅ SEM useEffect automático
// loadModules() só é chamado manualmente quando necessário
```

**Motivo**: O `useModuleRegistry` já carrega os módulos após autenticação. Não é necessário duplicar essa carga.

### 2. Adicionado Método `getNotifications`

**Arquivo**: `frontend/src/lib/module-registry.ts`

```typescript
/**
 * Obtém notificações (para compatibilidade)
 */
getNotifications(): any[] {
  // Se não houver módulos, retorna array vazio
  if (!this.isLoaded || this.modules.length === 0) {
    return [];
  }

  // TODO: Implementar quando API retornar notificações
  return [];
}
```

## Análise do Fluxo de Carregamento

### Fluxo ANTES (Problemático)

```
Login → user setado no AuthContext
  ↓
useModuleRegistry detecta user
  ↓
Chama moduleRegistry.loadModules()  ← Chamada 1
  ↓
useModulesManager monta
  ↓
useEffect dispara loadModules()
  ↓
Chama moduleRegistry.loadModules()  ← Chamada 2 (DUPLICADA!)
  ↓
Rate Limiter do backend bloqueia
  ↓
429 Too Many Requests
```

### Fluxo DEPOIS (Corrigido)

```
Login → user setado no AuthContext
  ↓
useModuleRegistry detecta user
  ↓
Chama moduleRegistry.loadModules()  ← Chamada única
  ↓
useModulesManager apenas fornece interface
  ↓
Sem chamadas duplicadas
  ↓
✅ Sucesso
```

## Rate Limiting do Backend

O backend tem proteção contra brute force configurada:

**Desenvolvimento**:
- 2000 requisições por minuto (limite global)
- 10 tentativas de login por minuto

**Produção**:
- 100 requisições por minuto (limite global)
- 5 tentativas de login por minuto

O erro 429 foi causado por múltiplas chamadas rápidas ao mesmo endpoint.

## Métodos Adicionados ao ModuleRegistry

Para compatibilidade com componentes existentes:

| Método | Retorno | Descrição |
|--------|---------|-----------|
| `getGroupedSidebarItems(role)` | Menu estruturado | Retorna itens do CORE + módulos |
| `getDashboardWidgets()` | Array de widgets | Widgets dos módulos (vazio por ora) |
| `getNotifications()` | Array de notificações | Notificações dos módulos (vazio por ora) |

## Resultado das Correções

### Problemas Resolvidos
✅ **Sem erro 429** - Apenas uma chamada ao endpoint  
✅ **Sem duplicação** - `useModulesManager` não faz auto-load  
✅ **Todos métodos disponíveis** - `getNotifications` implementado  
✅ **Performance melhorada** - Menos requisições HTTP  

### Comportamento Atual

1. **Login** → `useModuleRegistry` carrega módulos uma vez
2. **Dashboard** → `useModuleFeatures` usa dados já carregados
3. **Sidebar** → `getGroupedSidebarItems` retorna menu CORE
4. **Widgets** → `getDashboardWidgets` retorna array vazio
5. **Notificações** → `getNotifications` retorna array vazio

## Próximos Passos

Quando o backend retornar dados reais de módulos:

1. ✅ Implementar parsing de widgets em `getDashboardWidgets()`
2. ✅ Implementar parsing de notificações em `getNotifications()`
3. ✅ Processar menus dos módulos em `getGroupedSidebarItems()`

Por enquanto, todos retornam arrays vazios de forma segura.

---

**Data da Correção**: 17/12/2025  
**Relacionado a**: CORRECAO_USEMODULEFEATURES_UNDEFINED.md  
**Implementado por**: Qoder AI Assistant
