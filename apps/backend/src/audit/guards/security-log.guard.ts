import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditLogData, AuditService } from '../audit.service';
import { SECURITY_LOG_KEY, SecurityLogOptions } from '../decorators/security-log.decorator';
import { Request } from 'express';

type SecurityLogRequestUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  tenantId?: string | null;
};

type SecurityLogRequest = Request & {
  user?: SecurityLogRequestUser;
};

@Injectable()
export class SecurityLogGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const securityLogOptions = this.reflector.getAllAndOverride<SecurityLogOptions>(
      SECURITY_LOG_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!securityLogOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<SecurityLogRequest>();

    // Coletar informações baseadas nas opções
    const logData: AuditLogData = {
      action: securityLogOptions.action
    };

    // Incluir usuário se solicitado
    if (securityLogOptions.includeUser) {
      const user = request.user;
      if (user) {
        logData.userId = user.id;
        logData.metadata = {
          ...(logData.metadata || {}),
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
        };
      }
    }

    // Incluir tenant se solicitado
    if (securityLogOptions.includeTenant) {
      const user = request.user;
      if (user?.tenantId) {
        logData.tenantId = user.tenantId;
      }
    }

    // Incluir IP se solicitado
    if (securityLogOptions.includeIp) {
      logData.ipAddress = this.getClientIp(request);
    }

    // Incluir User-Agent se solicitado
    if (securityLogOptions.includeUserAgent) {
      logData.userAgent = request.get('user-agent') || '';
    }

    // Detalhes personalizados
    const details: Record<string, unknown> = {
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString(),
      ...securityLogOptions.customDetails
    };

    // Adicionar parâmetros da requisição (sem dados sensíveis)
    if (request.params && Object.keys(request.params).length > 0) {
      details.params = this.sanitizeParams(request.params as Record<string, unknown>);
    }

    if (request.query && Object.keys(request.query).length > 0) {
      details.query = this.sanitizeParams(request.query as Record<string, unknown>);
    }

    logData.details = details;

    try {
      // Registrar log de acesso
      await this.auditService.log(logData);
    } catch (error) {
      // Não bloquear a requisição se o log falhar
      console.error('Falha ao registrar log de segurança:', error);
    }

    return true;
  }

  private getClientIp(request: Request): string {
    return (
      request.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.get('x-real-ip') ||
      request.get('x-client-ip') ||
      request.ip ||
      'unknown'
    );
  }

  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    // Campos sensíveis que devem ser mascarados
    const sensitiveFields = [
      'password', 'senha', 'token', 'authorization', 'auth',
      'creditCard', 'cartaoCredito', 'cpf', 'cnpj', 'rg'
    ];

    for (const [key, value] of Object.entries(params)) {
      if (sensitiveFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
