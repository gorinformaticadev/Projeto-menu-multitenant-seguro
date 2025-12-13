# ARQUITETURA MODULAR REFATORADA

## Resumo da Reestruturação

O sistema de módulos foi completamente refatorado seguindo os princípios de **estabilidade**, **determinismo** e **contratos explícitos**.

### ❌ PROBLEMAS ELIMINADOS

1. **Auto-loader frágil**: Removido sistema baseado em `readdirSync` e `existsSync`
2. **Lógica mágica**: Eliminadas convenções implícitas e descoberta automática
3. **Sidebar hardcoded**: Menu agora é dinâmico baseado no Module Registry
4. **Módulos isolados**: Agora há integração real através de contratos explícitos
5. **Comportamento imprevisível**: Sistema agora é determinístico

### ✅ NOVA ARQUITETURA IMPLEMENTADA

## 1. Module Registry Centralizado

**Localização**: `core/shared/registry/module-registry.ts`

- **Singleton determinístico**: Uma única instância controlada
- **Contratos explícitos**: Interfaces claras definidas em `module.types.ts`
- **Funções de agregação**: Core consulta o registry para obter dados
- **Filtragem automática**: Baseada em roles e permissões

```typescript
// Exemplo de uso
const sidebarItems = moduleRegistry.getSidebarItems(user.role, user.permissions);
const dashboardWidgets = moduleRegistry.getDashboardWidgets(user.role, user.permissions);
```

## 2. Contratos Explícitos

**Localização**: `core/shared/types/module.types.ts`

Cada módulo declara explicitamente o que oferece:

```typescript
interface ModuleContribution {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  
  // Contribuições opcionais - se não declarar, core ignora
  sidebar?: ModuleMenuItem[];
  dashboard?: ModuleDashboardWidget[];
  taskbar?: ModuleTaskbarItem[];
  userMenu?: ModuleUserMenuItem[];
  notifications?: ModuleNotification[];
}
```

## 3. Registro Explícito de Módulos

**Localização**: `core/shared/modules/module-loader.ts`

- **Lista explícita**: Módulos devem ser declarados na constante `AVAILABLE_MODULES`
- **Sem auto-discovery**: Cada módulo tem função de registro específica
- **Controle total**: Desenvolvedor decide quais módulos carregar

```typescript
const AVAILABLE_MODULES = [
  'sample-module',
  // 'financeiro',  // Descomente para ativar
  // 'os',          // Descomente para ativar
] as const;
```

## 4. Core Responsável por Agregação

O **core** é o único responsável por:

### Sidebar
- **Componente**: `core/frontend/src/components/Sidebar.tsx`
- **Funcionamento**: Consulta `moduleRegistry.getSidebarItems()`
- **Resultado**: Menu dinâmico baseado em módulos registrados

### Dashboard
- **Componente**: `core/frontend/src/components/dashboard/DashboardWidgets.tsx`
- **Funcionamento**: Consulta `moduleRegistry.getDashboardWidgets()`
- **Resultado**: Widgets dinâmicos de todos os módulos

### Inicialização
- **Hook**: `core/frontend/src/hooks/useModuleRegistry.ts`
- **Funcionamento**: Inicializa registry e carrega módulos
- **Integração**: `AppLayout.tsx` aguarda inicialização

## 5. Fluxo de Funcionamento

### Inicialização do Sistema
1. `AppLayout` chama `useModuleRegistry()`
2. Hook registra módulo core (`registerCoreModule()`)
3. Hook carrega módulos externos (`loadExternalModules()`)
4. Sistema fica pronto para uso

### Renderização do Menu
1. `Sidebar` chama `moduleRegistry.getSidebarItems(user.role, user.permissions)`
2. Registry agrega itens de todos os módulos registrados
3. Registry filtra baseado em permissões/roles
4. Sidebar renderiza itens filtrados

### Renderização do Dashboard
1. `DashboardWidgets` chama `moduleRegistry.getDashboardWidgets(user.role, user.permissions)`
2. Registry agrega widgets de todos os módulos registrados
3. Registry filtra baseado em permissões/roles
4. Componente renderiza widgets filtrados

## 6. Como Adicionar Novos Módulos

### Passo 1: Adicionar à Lista
```typescript
// Em core/shared/modules/module-loader.ts
const AVAILABLE_MODULES = [
  'sample-module',
  'meu-novo-modulo', // ← Adicionar aqui
] as const;
```

### Passo 2: Implementar Função de Registro
```typescript
// Em core/shared/modules/module-loader.ts
async function registerMeuNovoModuloModule(): Promise<void> {
  const contribution: ModuleContribution = {
    id: 'meu-novo-modulo',
    name: 'Meu Novo Módulo',
    version: '1.0.0',
    enabled: true,
    
    sidebar: [
      {
        id: 'meu-item',
        name: 'Meu Item',
        href: '/meu-modulo',
        icon: 'Settings',
        order: 60
      }
    ]
  };

  moduleRegistry.register(contribution);
}
```

### Passo 3: Adicionar ao Switch
```typescript
// Em core/shared/modules/module-loader.ts
async function loadModule(moduleId: ModuleId): Promise<void> {
  switch (moduleId) {
    case 'sample-module':
      await registerSampleModule();
      break;
    
    case 'meu-novo-modulo': // ← Adicionar aqui
      await registerMeuNovoModuloModule();
      break;
  }
}
```

## 7. Regras de Funcionamento

### ✅ O que o Core Faz
- Agrega contribuições de módulos
- Filtra baseado em permissões/roles
- Renderiza UI baseado em dados agregados
- Gerencia inicialização do sistema

### ✅ O que os Módulos Fazem
- Declaram suas contribuições
- Registram-se no Module Registry
- Fornecem componentes quando solicitados

### ❌ O que os Módulos NÃO Fazem
- Não modificam arquivos do core
- Não acessam estruturas internas do core
- Não tomam decisões sobre renderização
- Não fazem auto-discovery

## 8. Benefícios da Nova Arquitetura

### Estabilidade
- Comportamento previsível e determinístico
- Sem lógica mágica ou convenções implícitas
- Controle total sobre carregamento de módulos

### Manutenibilidade
- Contratos explícitos e bem definidos
- Separação clara de responsabilidades
- Fácil adição/remoção de módulos

### Performance
- Carregamento controlado e otimizado
- Sem varredura desnecessária de arquivos
- Filtragem eficiente baseada em permissões

### Segurança
- Módulos não podem modificar o core
- Controle granular de permissões
- Isolamento entre módulos

## 9. Estrutura de Arquivos

```
core/
├── shared/
│   ├── types/
│   │   └── module.types.ts          # Contratos explícitos
│   ├── registry/
│   │   └── module-registry.ts       # Registry centralizado
│   └── modules/
│       ├── core-module.ts           # Registro do módulo core
│       └── module-loader.ts         # Carregador explícito
└── frontend/
    ├── src/
    │   ├── hooks/
    │   │   └── useModuleRegistry.ts  # Hook de inicialização
    │   └── components/
    │       ├── Sidebar.tsx           # Menu dinâmico
    │       └── dashboard/
    │           └── DashboardWidgets.tsx # Widgets dinâmicos
```

---

## ✅ SISTEMA REFATORADO COM SUCESSO

A arquitetura agora é:
- **Determinística**: Comportamento previsível
- **Estável**: Sem auto-discovery ou lógica mágica  
- **Extensível**: Fácil adição de novos módulos
- **Segura**: Módulos não podem quebrar o core
- **Performática**: Carregamento controlado e otimizado

**O core manda. Módulos apenas se apresentam.**