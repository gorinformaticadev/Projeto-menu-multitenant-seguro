# CORE - Plataforma Modular Ideal

## Visão Geral

O **CORE** é uma plataforma modular 100% extensível que funciona como **infraestrutura**, não como sistema final. Ele fornece o ambiente para que módulos resolvam problemas de negócio, sem conhecer ou limitar suas funcionalidades.

### Princípio Fundamental

> **O CORE não resolve problemas de negócio. Ele apenas cria o ambiente para que módulos resolvam.**

## 📦 Estrutura

```
core/
├── contracts/          # Contratos e tipos
├── events/             # Sistema de eventos
├── context/            # Contexto global
├── modules/            # Sistema de módulos
└── ui/                 # Managers de UI
```

## 🎯 Responsabilidades do CORE

### ✅ O QUE O CORE FAZ

- ✅ Fornece infraestrutura (eventos, contexto, managers)
- ✅ Carrega módulos dinamicamente
- ✅ Valida contratos de módulos
- ✅ Resolve dependências entre módulos
- ✅ Dispara eventos em momentos definidos
- ✅ Agrega contribuições de módulos (menus, widgets, notificações)
- ✅ Filtra baseado em permissões do usuário

### ❌ O QUE O CORE NUNCA FAZ

- ❌ Criar regras de negócio
- ❌ Conhecer nomes específicos de módulos
- ❌ Criar menus fixos hardcoded
- ❌ Executar lógica condicional baseada em módulos
- ❌ Forçar estruturas de UI
- ❌ Bloquear funcionalidades de módulos

## 🚀 Uso Básico

### Criar um Módulo

```typescript
import { ModuleContract, CoreContext } from '@core';

export const module: ModuleContract = {
  name: 'meu-modulo',
  slug: 'meu-modulo',
  version: '1.0.0',
  displayName: 'Meu Módulo',
  description: 'Descrição',
  author: 'Desenvolvedor',

  async boot(context: CoreContext) {
    // Registrar rotas
    context.events.on('routes:register', ({ router }) => {
      router.get('/api/meu-modulo', (req, res) => {
        res.json({ message: 'Hello!' });
      });
    });

    // Adicionar menu
    context.menu.add({
      id: 'meu-menu',
      label: 'Meu Módulo',
      href: '/meu-modulo',
      icon: 'star',
      order: 50,
    });

    // Registrar widget
    context.dashboard.addWidget({
      id: 'meu-widget',
      title: 'Meu Widget',
      component: 'MeuWidget',
      size: 'medium',
      order: 10,
    });
  },
};

export default module;
```

### Inicializar o Sistema

```typescript
import { ModuleLoader, ContextFactory, eventBus } from '@core';

async function bootstrap() {
  // Criar contexto
  const context = ContextFactory.createBootContext({
    db, cache, logger, events: eventBus,
    router, notifier, menu, dashboard, acl,
    environment: Environment.DEVELOPMENT,
  });

  // Disparar evento de boot
  await eventBus.emit('core:boot', {
    timestamp: new Date(),
    environment: 'development',
  });

  // Carregar módulos
  const loader = new ModuleLoader({
    modulesPath: './modules',
    coreVersion: '1.0.0',
  });

  await loader.loadAll(context);

  // Sistema pronto
  await eventBus.emit('core:ready', {
    modules: loader.registry.getSlugs(),
    timestamp: new Date(),
  });
}
```

## 📋 Componentes Principais

### EventBus

Sistema de eventos type-safe para comunicação desacoplada.

```typescript
import { eventBus } from '@core';

// Registrar listener
eventBus.on('user:authenticated', (payload) => {
  console.log('Usuário autenticado:', payload.user);
});

// Disparar evento
await eventBus.emit('user:authenticated', {
  user,
  requestId: '123',
  timestamp: new Date(),
});
```

### CoreContext

Contexto imutável injetado em todos os módulos.

```typescript
interface CoreContext {
  tenant: Tenant | null;
  user: User | null;
  permissions: string[];
  db: DatabaseConnection;
  cache: CacheManager;
  logger: Logger;
  events: EventBus;
  router: RouterManager;
  notifier: NotificationManager;
  menu: MenuManager;
  dashboard: DashboardManager;
  acl: ACLManager;
  requestId: string;
  timestamp: Date;
  environment: Environment;
}
```

### ModuleLoader

Carregador de módulos com validação e resolução de dependências.

```typescript
const loader = new ModuleLoader({
  modulesPath: './modules',
  coreVersion: '1.0.0',
  failOnError: false,
  ignoreModules: ['deprecated-module'],
});

const result = await loader.loadAll(context);
// result.loaded: ['module-a', 'module-b']
// result.failed: []
// result.duration: 1234ms
```

### Managers

Agregadores de contribuições de módulos.

```typescript
// MenuManager
menuManager.add({ id: 'item', label: 'Item', href: '/item', order: 10 });
const items = menuManager.getItems(user);

// DashboardManager
dashboardManager.addWidget({ id: 'widget', title: 'Widget', ... });
const widgets = dashboardManager.getWidgets(user);

// NotificationManager
notificationManager.registerChannel('email', emailHandler);
await notificationManager.send('email', message, targets);
```

## 🔒 Segurança

- **Filtragem automática** por roles e permissões
- **Contextos imutáveis** previnem efeitos colaterais
- **Validação rigorosa** de contratos de módulos
- **Isolamento** entre módulos

## 📊 Eventos do Sistema

| Evento | Quando Dispara | Síncrono |
|--------|---------------|----------|
| `core:boot` | Inicialização do sistema | ✅ |
| `core:ready` | Sistema pronto | ✅ |
| `core:shutdown` | Desligamento | ✅ |
| `routes:register` | Registro de rotas | ✅ |
| `menu:register` | Registro de menus | ✅ |
| `dashboard:register` | Registro de widgets | ✅ |
| `permissions:register` | Registro de permissões | ✅ |
| `notifications:register` | Registro de canais | ✅ |
| `tenant:resolved` | Tenant identificado | ❌ |
| `user:authenticated` | Usuário autenticado | ❌ |

## 🧪 Testabilidade

O CORE é 100% testável isoladamente:

```typescript
// Testar CORE sem módulos
describe('EventBus', () => {
  it('should emit events', async () => {
    const listener = jest.fn();
    eventBus.on('core:boot', listener);
    await eventBus.emit('core:boot', { timestamp: new Date(), environment: 'test' });
    expect(listener).toHaveBeenCalled();
  });
});

// Testar módulos com mock
describe('MyModule', () => {
  it('should boot correctly', async () => {
    const mockContext = createMockContext();
    await myModule.boot(mockContext);
    expect(mockContext.menu.add).toHaveBeenCalled();
  });
});
```

## 📚 Documentação Completa

- [Design do CORE](../.qoder/quests/modular-platform-core.md)
- [Implementação Completa](./CORE_IDEAL_IMPLEMENTACAO_COMPLETA.md)
- [Fase 1 - Fundação](./CORE_IDEAL_IMPLEMENTACAO_FASE1.md)

## 🤝 Como Contribuir

1. Módulos devem implementar `ModuleContract`
2. Usar `boot(context)` para inicialização
3. Escutar eventos do CORE, não modificá-lo
4. Registrar contribuições via managers
5. Nunca modificar arquivos do CORE

## ⚡ Performance

- **Carregamento otimizado**: Resolução de dependências em O(V + E)
- **Filtragem eficiente**: Cache de permissões
- **Eventos assíncronos**: Fire-and-forget onde apropriado

## 🎉 Resultado

Um CORE que:
- ✅ Nunca precisa ser alterado ao criar módulos
- ✅ Nunca quebra ao instalar/remover módulos
- ✅ Nunca limita funcionalidades
- ✅ Funciona como uma plataforma verdadeiramente modular

**O CORE é estável. Os módulos são livres.** 🚀
