/**
 * SISTEMA DE NOTIFICAÇÕES MODULAR - TIPOS E CONTRATOS
 * 
 * Arquitetura: Core + Módulos
 * Multi-tenant: Isolamento por tenant
 * Multi-perfil: user, admin, super_admin
 */

// ============================================================================
// EVENTOS (Emitidos por Core ou Módulos)
// ============================================================================

export interface NotificationEvent {
  /** Tipo do evento (ex: "user_created", "payment_failed", "module_error") */
  type: string;
  
  /** Origem do evento */
  source: "core" | "module";
  
  /** Nome do módulo (obrigatório se source = "module") */
  module?: string;
  
  /** Severidade do evento */
  severity: "info" | "warning" | "critical";
  
  /** ID do tenant (null = global/sistema) */
  tenantId?: string | null;
  
  /** ID do usuário específico (null = todos do tenant/sistema) */
  userId?: string | null;
  
  /** Dados específicos do evento */
  payload: {
    title: string;
    message: string;
    /** Contexto para redirecionamento (ex: "/orders/123", "/users/456") */
    context?: string;
    /** Dados extras específicos do módulo/core */
    data?: Record<string, any>;
  };
  
  /** Timestamp do evento */
  timestamp: Date;
}

// ============================================================================
// NOTIFICAÇÕES (Processadas e Persistidas)
// ============================================================================

export interface Notification {
  id: string;
  
  /** Título da notificação */
  title: string;
  
  /** Mensagem da notificação */
  message: string;
  
  /** Severidade */
  severity: "info" | "warning" | "critical";
  
  /** Audiência alvo */
  audience: "user" | "admin" | "super_admin";
  
  /** Origem */
  source: "core" | "module";
  module?: string;
  
  /** Tenant (null = global) */
  tenantId?: string | null;
  
  /** Usuário específico (null = todos da audiência) */
  userId?: string | null;
  
  /** Contexto para redirecionamento */
  context?: string;
  
  /** Dados extras */
  data?: Record<string, any>;
  
  /** Status de leitura */
  read: boolean;
  
  /** Timestamps */
  createdAt: Date;
  readAt?: Date;
}

// ============================================================================
// FILTROS E CONSULTAS
// ============================================================================

export interface NotificationFilters {
  /** Severidade */
  severity?: "info" | "warning" | "critical" | "all";
  
  /** Origem */
  source?: "core" | "module" | "all";
  
  /** Módulo específico */
  module?: string;
  
  /** Tenant (apenas para super_admin) */
  tenantId?: string;
  
  /** Status de leitura */
  read?: boolean;
  
  /** Período */
  dateFrom?: Date;
  dateTo?: Date;
  
  /** Paginação */
  page?: number;
  limit?: number;
}

export interface NotificationResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  hasMore: boolean;
}

// ============================================================================
// REGRAS DE AUDIÊNCIA
// ============================================================================

export interface AudienceRules {
  /** Usuário comum */
  user: {
    /** Recebe apenas notificações direcionadas a ele */
    receives: ["info", "warning"];
    /** Nunca recebe críticas ou eventos de outros usuários */
    excludes: ["critical"];
    /** Filtros automáticos */
    filters: {
      /** Apenas suas próprias notificações */
      userSpecific: true;
      /** Apenas do seu tenant */
      tenantSpecific: true;
    };
  };
  
  /** Admin do tenant */
  admin: {
    /** Recebe info, warning e algumas críticas do tenant */
    receives: ["info", "warning", "critical"];
    /** Filtros automáticos */
    filters: {
      /** Todas as notificações do tenant */
      tenantSpecific: true;
      /** Críticas apenas operacionais, não técnicas */
      criticalFiltered: true;
    };
  };
  
  /** Super Admin */
  super_admin: {
    /** Recebe tudo */
    receives: ["info", "warning", "critical"];
    /** Sem filtros automáticos */
    filters: {
      /** Pode ver todos os tenants */
      crossTenant: true;
      /** Pode ver logs técnicos */
      technical: true;
    };
  };
}

// ============================================================================
// CONTRATOS PARA MÓDULOS
// ============================================================================

export interface ModuleNotificationContract {
  /** Função para emitir evento de notificação */
  emit: (event: Omit<NotificationEvent, 'source' | 'timestamp'>) => Promise<void>;
  
  /** Tipos de evento que o módulo pode emitir */
  supportedTypes: string[];
  
  /** Configurações do módulo */
  config: {
    /** Nome do módulo */
    name: string;
    /** Versão */
    version: string;
    /** Se pode emitir notificações críticas */
    canEmitCritical: boolean;
  };
}

// ============================================================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================================================

export interface NotificationSystemConfig {
  /** Limite de notificações no dropdown */
  dropdownLimit: number;
  
  /** Limite de notificações por página na central */
  pageLimit: number;
  
  /** Intervalo de polling (ms) */
  pollingInterval: number;
  
  /** Retenção de notificações (dias) */
  retentionDays: number;
  
  /** Rate limiting por usuário */
  rateLimiting: {
    /** Máximo de notificações por minuto por usuário */
    perMinute: number;
    /** Máximo de notificações por hora por tenant */
    perHourPerTenant: number;
  };
}

// ============================================================================
// HOOKS E SERVIÇOS
// ============================================================================

export interface NotificationHookReturn {
  /** Notificações carregadas */
  notifications: Notification[];
  
  /** Contagem de não lidas */
  unreadCount: number;
  
  /** Estado de carregamento */
  loading: boolean;
  
  /** Erro */
  error: string | null;
  
  /** Marcar como lida */
  markAsRead: (id: string) => Promise<void>;
  
  /** Marcar todas como lidas */
  markAllAsRead: () => Promise<void>;
  
  /** Deletar notificação */
  deleteNotification: (id: string) => Promise<void>;
  
  /** Recarregar */
  refresh: () => Promise<void>;
}

export interface NotificationCenterHookReturn extends NotificationHookReturn {
  /** Filtros ativos */
  filters: NotificationFilters;
  
  /** Aplicar filtros */
  setFilters: (filters: Partial<NotificationFilters>) => void;
  
  /** Carregar mais */
  loadMore: () => Promise<void>;
  
  /** Se há mais para carregar */
  hasMore: boolean;
  
  /** Total de notificações */
  total: number;
}