export class CreateSistemaDto {
  name: string;
  description?: string;
}

export class UpdateSistemaDto {
  name?: string;
  description?: string;
}

export class FilterSistemaDto {
  limit?: number;
  offset?: number;
}

/**
 * DTO para envio de notificações do módulo sistema
 */
export class SendNotificationDto {
  /** Título da notificação (máx 100 caracteres) */
  titulo: string;

  /** Mensagem da notificação (máx 500 caracteres) */
  mensagem: string;

  /** Tipo da notificação */
  tipo: 'info' | 'success' | 'warning' | 'error';

  /** Destino da notificação */
  destino: 'tenant_atual' | 'todos_tenants';

  /** Se é notificação crítica */
  critica: boolean;
}