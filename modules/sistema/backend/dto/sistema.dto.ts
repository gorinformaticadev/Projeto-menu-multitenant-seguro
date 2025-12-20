import { IsString, IsBoolean, IsIn, MaxLength, MinLength } from 'class-validator';

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
  @IsString({ message: 'Título deve ser uma string' })
  @MinLength(1, { message: 'Título é obrigatório' })
  @MaxLength(100, { message: 'Título deve ter no máximo 100 caracteres' })
  titulo: string;

  /** Mensagem da notificação (máx 500 caracteres) */
  @IsString({ message: 'Mensagem deve ser uma string' })
  @MinLength(1, { message: 'Mensagem é obrigatória' })
  @MaxLength(500, { message: 'Mensagem deve ter no máximo 500 caracteres' })
  mensagem: string;

  /** Tipo da notificação */
  @IsIn(['info', 'success', 'warning', 'error'], { message: 'Tipo inválido' })
  tipo: 'info' | 'success' | 'warning' | 'error';

  /** Destino da notificação */
  @IsIn(['tenant_atual', 'todos_tenants'], { message: 'Destino inválido' })
  destino: 'tenant_atual' | 'todos_tenants';

  /** Se é notificação crítica */
  @IsBoolean({ message: 'Crítica deve ser true ou false' })
  critica: boolean;
}