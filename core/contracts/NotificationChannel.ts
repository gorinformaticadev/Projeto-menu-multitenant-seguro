/**
 * Canal de notificação
 */

/**
 * Tipo de notificação
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Alvo da notificação
 */
export interface NotificationTarget {
  /** ID do usuário ou tenant */
  id: string;
  
  /** Tipo de alvo */
  type: 'user' | 'tenant' | 'role' | 'group';
}

/**
 * Mensagem de notificação
 */
export interface NotificationMessage {
  /** Tipo da notificação */
  type: NotificationType;
  
  /** Título da notificação */
  title: string;
  
  /** Mensagem da notificação */
  message: string;
  
  /** Dados adicionais */
  data?: Record<string, any>;
  
  /** Link de ação */
  actionUrl?: string;
  
  /** Texto do botão de ação */
  actionText?: string;
  
  /** Se a notificação pode ser fechada */
  dismissible?: boolean;
  
  /** Duração de exibição (ms) - 0 para permanente */
  duration?: number;
}

/**
 * Handler de canal de notificação
 */
export type NotificationChannelHandler = (
  message: NotificationMessage,
  targets: NotificationTarget[]
) => Promise<void>;

/**
 * Canal de notificação
 */
export interface NotificationChannel {
  /** Nome do canal */
  name: string;
  
  /** Descrição do canal */
  description?: string;
  
  /** Handler que processa as notificações */
  handler: NotificationChannelHandler;
  
  /** Se o canal está ativo */
  enabled: boolean;
}
