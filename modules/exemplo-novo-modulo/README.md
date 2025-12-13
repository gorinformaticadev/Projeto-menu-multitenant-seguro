# Exemplo de Módulo Seguindo Nova Arquitetura

Este é um exemplo de como criar um módulo seguindo a nova arquitetura modular refatorada.

## Estrutura do Módulo

```
modules/exemplo-novo-modulo/
├── README.md                    # Este arquivo
├── frontend/
│   ├── pages/
│   │   └── ExemploPage.tsx     # Páginas do módulo
│   └── components/
│       └── ExemploWidget.tsx   # Componentes do módulo
└── backend/
    ├── controllers/
    │   └── exemplo.controller.ts
    └── services/
        └── exemplo.service.ts
```

## Como Registrar Este Módulo

### 1. Adicionar à Lista de Módulos Disponíveis

Em `core/shared/modules/module-loader.ts`:

```typescript
const AVAILABLE_MODULES = [
  'sample-module',
  'exemplo-novo-modulo', // ← Adicionar aqui
] as const;
```

### 2. Implementar Função de Registro

Em `core/shared/modules/module-loader.ts`:

```typescript
async function registerExemploNovoModuloModule(): Promise<void> {
  const contribution: ModuleContribution = {
    id: 'exemplo-novo-modulo',
    name: 'Exemplo Novo Módulo',
    version: '1.0.0',
    enabled: true,
    
    sidebar: [
      {
        id: 'exemplo-menu',
        name: 'Exemplo',
        href: '/exemplo',
        icon: 'Settings',
        order: 50,
        roles: ['ADMIN', 'USER'] // Opcional
      }
    ],
    
    dashboard: [
      {
        id: 'exemplo-widget',
        name: 'Widget Exemplo',
        component: 'ExemploWidget',
        order: 15,
        size: 'medium'
      }
    ],
    
    userMenu: [
      {
        id: 'exemplo-user-item',
        name: 'Configurações do Exemplo',
        href: '/exemplo/config',
        icon: 'Settings',
        order: 10
      }
    ]
  };

  moduleRegistry.register(contribution);
  console.log('Módulo Exemplo registrado');
}
```

### 3. Adicionar ao Switch de Carregamento

Em `core/shared/modules/module-loader.ts`:

```typescript
async function loadModule(moduleId: ModuleId): Promise<void> {
  switch (moduleId) {
    case 'sample-module':
      await registerSampleModule();
      break;
    
    case 'exemplo-novo-modulo': // ← Adicionar aqui
      await registerExemploNovoModuloModule();
      break;
  }
}
```

### 4. Criar Componente Widget (se necessário)

Em `core/frontend/src/components/dashboard/DashboardWidgets.tsx`:

```typescript
const widgetComponents: Record<string, React.ComponentType<any>> = {
  WelcomeWidget: () => (...),
  StatsWidget: () => (...),
  SampleWidget: () => (...),
  
  ExemploWidget: () => ( // ← Adicionar aqui
    <div className="p-4 bg-card rounded-lg border">
      <h4 className="font-medium mb-1">Exemplo Módulo</h4>
      <p className="text-sm text-muted-foreground">
        Widget do módulo de exemplo
      </p>
    </div>
  )
};
```

## Regras Importantes

### ✅ O que o Módulo PODE Fazer
- Declarar suas contribuições (sidebar, dashboard, etc.)
- Fornecer componentes React para widgets
- Implementar suas próprias páginas e rotas
- Definir permissões e roles necessárias

### ❌ O que o Módulo NÃO PODE Fazer
- Modificar arquivos do core diretamente
- Acessar estruturas internas do core
- Fazer auto-discovery ou lógica mágica
- Tomar decisões sobre renderização global

### 📋 Checklist para Novo Módulo

- [ ] Adicionar ID na lista `AVAILABLE_MODULES`
- [ ] Implementar função `registerNomeDoModuloModule()`
- [ ] Adicionar case no switch de `loadModule()`
- [ ] Criar componentes de widget (se necessário)
- [ ] Testar se aparece no menu
- [ ] Testar se widgets aparecem no dashboard
- [ ] Verificar permissões e roles

## Resultado Esperado

Após seguir estes passos:

1. **Menu**: Item "Exemplo" aparece no sidebar
2. **Dashboard**: Widget "Widget Exemplo" aparece no dashboard
3. **Menu do Usuário**: Item "Configurações do Exemplo" aparece no menu do usuário
4. **Estabilidade**: Sistema continua funcionando mesmo se módulo falhar

---

**Lembre-se**: O core manda. Módulos apenas se apresentam.