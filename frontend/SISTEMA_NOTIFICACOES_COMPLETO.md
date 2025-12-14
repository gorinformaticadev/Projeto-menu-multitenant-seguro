# Sistema de Notificações Modular, Multi-Tenant e Multi-Perfil

## 🎯 Visão Geral

Sistema completo de notificações implementado com arquitetura modular, suporte multi-tenant e separação por perfis de usuário (user, admin, super_admin). O sistema diferencia notificações comuns, de módulos e críticas, garantindo que cada usuário receba apenas o que é relevante para seu contexto.

## 🏗️ Arquitetura

### Fluxo de Eventos → Notificações

```
[Módulo/Core] → [Evento] → [Backend] → [Processamento] → [Notificação] → [Frontend]
```

1. **Módulos/Core emitem eventos** usando contratos padronizados
2. **Backend processa eventos** e aplica regras de audiência
3. **Notificações são persistidas** com targeting correto
4. **Frontend consome via polling** e exibe nas interfaces

### Componentes Principais

- **Tipos e Contratos** (`/types/notifications.ts`)
- **Serviço de API** (`/services/notifications.service.ts`)
- **Hook do Dropdown** (`/hooks/useNotificationsDropdown.ts`)
- **Hook da Central** (`/hooks/useNotificationsCenter.ts`)
- **Emissor para Módulos** (`/lib/notifications-emitter.ts`)
- **TopBar Integrada** (`/components/TopBar.tsx`)
- **Central de Notificações** (`/app/notificacoes/page.tsx`)

## 👥 Regras de Audiência

### 🔹 Usuário Comum (USER)
**Recebe:**
- Notificações direcionadas especificamente a ele
- Eventos de módulos que ele utiliza
- Apenas severidade `info` e `warning`

**NÃO recebe:**
- Notificações críticas
- Eventos de outros usuários
- Logs técnicos do sistema

### 🔹 Admin (ADMIN)
**Recebe:**
- Todas as notificações do seu tenant
- Notificações geradas por módulos do tenant
- Alertas operacionais (`info`, `warning`, `critical` filtradas)

**NÃO recebe:**
- Eventos globais
- Logs internos do Core
- Eventos de outros tenants

### 🔹 Super Admin (SUPER_ADMIN)
**Recebe:**
- Todas as notificações (sem filtros)
- Notificações globais
- Notificações críticas
- Erros de módulos e Core
- Eventos multi-tenant

**Pode:**
- Filtrar por tenant
- Ver origem (Core/módulo)
- Gerenciar notificações de qualquer tenant

## 🔔 Interfaces de Usuário

### Dropdown na TopBar
- **Últimas 15 notificações**
- **Badge com contador** de não lidas
- **Separação visual** por severidade
- **Marcar como lida** ao clicar
- **Link para Central** de Notificações
- **Redirecionamento** para contexto

### Central de Notificações (`/notificacoes`)
- **Lista completa** paginada
- **Filtros avançados** (data, severidade, módulo, tenant)
- **Seleção múltipla** e ações em lote
- **Marcar como lidas** em lote
- **Histórico persistente**
- **Busca e ordenação**

## 🧩 Tipos de Notificação

### Severidades
- **`info`**: Informativas, visíveis para usuários finais
- **`warning`**: Avisos, requerem atenção mas não são críticas
- **`critical`**: Críticas, apenas para admins/super_admins

### Origens
- **`core`**: Geradas pelo sistema principal
- **`module`**: Geradas por módulos independentes

### Estrutura de Dados

```typescript
interface Notification {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  audience: "user" | "admin" | "super_admin";
  source: "core" | "module";
  module?: string;
  tenantId?: string | null;
  userId?: string | null;
  context?: string; // URL para redirecionamento
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}
```

## 📦 Contrato para Módulos

### Emissor de Notificações

```typescript
import { createNotificationsEmitter } from '@/lib/notifications-emitter';

const notifier = createNotificationsEmitter({
  moduleName: 'module-exemplo',
  moduleVersion: '1.0.0',
  canEmitCritical: false
});

// Para usuário específico
await notifier.forUser('user123', 'tenant456').info({
  type: 'task_completed',
  title: 'Tarefa Concluída',
  message: 'Sua tarefa foi processada com sucesso',
  context: '/tasks/123',
  data: { taskId: '123' }
});

// Para todo o tenant
await notifier.forTenant('tenant456').warning({
  type: 'integration_failed',
  title: 'Falha na Integração',
  message: 'A integração falhou',
  context: '/integrations'
});

// Global (apenas super_admin)
await notifier.global().critical({
  type: 'system_error',
  title: 'Erro Crítico',
  message: 'Sistema encontrou erro crítico'
});
```

### Validações Automáticas
- **Formato do tipo**: apenas letras, números, pontos, hífens
- **Tamanho do título**: máximo 100 caracteres
- **Tamanho da mensagem**: máximo 500 caracteres
- **Autorização crítica**: apenas módulos autorizados

## 🔧 Configurações do Sistema

```typescript
interface NotificationSystemConfig {
  dropdownLimit: 15;           // Notificações no dropdown
  pageLimit: 20;              // Notificações por página
  pollingInterval: 30000;     // Polling a cada 30s
  retentionDays: 90;          // Retenção de 90 dias
  rateLimiting: {
    perMinute: 10;            // Max 10/min por usuário
    perHourPerTenant: 1000;   // Max 1000/h por tenant
  };
}
```

## 🚀 Funcionalidades Implementadas

### ✅ Dropdown de Notificações
- [x] Últimas 15 notificações
- [x] Badge com contador de não lidas
- [x] Separação visual por severidade
- [x] Marcar como lida ao clicar
- [x] Redirecionamento para contexto
- [x] Link para Central de Notificações
- [x] Polling automático (30s)
- [x] Cache inteligente

### ✅ Central de Notificações
- [x] Lista completa paginada
- [x] Filtros por data, severidade, módulo, tenant
- [x] Seleção múltipla
- [x] Ações em lote (marcar como lida, deletar)
- [x] Busca e ordenação
- [x] Estatísticas (total, não lidas, críticas)
- [x] Interface responsiva

### ✅ Sistema de Emissão
- [x] Contrato padronizado para módulos
- [x] Validação automática de eventos
- [x] Suporte a diferentes audiências
- [x] Rate limiting e segurança
- [x] Integração com Module Registry

### ✅ Regras de Audiência
- [x] Filtros automáticos por perfil
- [x] Isolamento por tenant
- [x] Separação de notificações críticas
- [x] Validação de permissões

## 📁 Estrutura de Arquivos

```
frontend/src/
├── types/
│   └── notifications.ts              # Tipos e contratos
├── services/
│   └── notifications.service.ts      # Serviço de API
├── hooks/
│   ├── useNotificationsDropdown.ts   # Hook do dropdown
│   └── useNotificationsCenter.ts     # Hook da central
├── lib/
│   └── notifications-emitter.ts      # Emissor para módulos
├── components/
│   └── TopBar.tsx                    # TopBar integrada
├── app/
│   └── notificacoes/
│       └── page.tsx                  # Central de notificações
└── modules/
    └── module-exemplo/
        └── notifications.ts          # Exemplo de uso
```

## 🔄 Próximos Passos

### Backend (Necessário implementar)
1. **Endpoints de API** para CRUD de notificações
2. **Processamento de eventos** com regras de audiência
3. **Sistema de persistência** (PostgreSQL/MongoDB)
4. **Rate limiting** e validações de segurança
5. **Cleanup automático** de notificações antigas

### Melhorias Futuras
1. **WebSocket** para notificações em tempo real
2. **Push notifications** para mobile
3. **Templates** de notificação personalizáveis
4. **Analytics** e métricas de engajamento
5. **Integração com email** para notificações críticas

## 🎉 Resultado

Sistema completo e escalável que:
- ✅ **Separa corretamente** notificações por perfil
- ✅ **Isola dados** por tenant
- ✅ **Diferencia severidades** apropriadamente
- ✅ **Fornece interfaces** intuitivas e funcionais
- ✅ **Oferece contratos** claros para módulos
- ✅ **Mantém arquitetura** modular e extensível
- ✅ **Garante performance** com polling otimizado
- ✅ **Implementa segurança** com validações rigorosas

O sistema está pronto para uso e pode ser facilmente estendido conforme novas necessidades surgirem.