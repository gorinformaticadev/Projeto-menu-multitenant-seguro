import { SetMetadata } from '@nestjs/common';

export const SECURITY_LOG_KEY = 'securityLog';

export interface SecurityLogOptions {
  action: string;
  includeUser?: boolean;
  includeTenant?: boolean;
  includeIp?: boolean;
  includeUserAgent?: boolean;
  customDetails?: Record<string, any>;
}

/**
 * Decorator para marcar endpoints que devem ser registrados no log de segurança
 * 
 * @param options - Configurações do log de segurança
 * 
 * Exemplo de uso:
 * 
 * @Post('sensitive-operation')
 * @SecurityLog({
 *   action: 'SENSITIVE_DATA_ACCESS',
 *   includeUser: true,
 *   includeTenant: true,
 *   customDetails: { operation: 'view_financial_data' }
 * })
 * async sensitiveOperation(@Body() data: any) {
 *   // operação sensível
 * }
 */
export const SecurityLog = (options: SecurityLogOptions) => SetMetadata(SECURITY_LOG_KEY, options);