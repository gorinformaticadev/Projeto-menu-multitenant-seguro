import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../audit.service';
import { Request } from 'express';

@Injectable()
export class SecurityAuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    
    // Coletar informações básicas
    const startTime = Date.now();
    const userAgent = request.get('user-agent') || '';
    const ipAddress = this.getClientIp(request);
    const method = request.method;
    const url = request.url;
    const userId = (request as any).user?.id;
    const tenantId = (request as any).user?.tenantId;

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Log de sucesso para operações críticas
          this.logSuccessfulOperation(request, response, startTime, {
            userId,
            tenantId,
            ipAddress,
            userAgent
          });
        },
        error: (error) => {
          // Log de falhas de segurança
          this.logSecurityViolation(request, error, {
            userId,
            tenantId,
            ipAddress,
            userAgent
          });
        }
      })
    );
  }

  private logSuccessfulOperation(
    request: Request,
    response: any,
    startTime: number,
    context: { userId?: string; tenantId?: string; ipAddress: string; userAgent: string }
  ) {
    const method = request.method;
    const url = request.url;
    const statusCode = response.statusCode;
    const duration = Date.now() - startTime;

    // Operações que merecem log automático
    const criticalOperations = [
      'POST /auth/login',
      'POST /auth/register',
      'PUT /users/profile',
      'POST /users',
      'DELETE /users',
      'POST /tenants',
      'PUT /tenants',
      'DELETE /tenants',
      'POST /modules',
      'PUT /modules',
      'DELETE /modules'
    ];

    const operationKey = `${method} ${url.split('?')[0]}`;
    
    if (criticalOperations.includes(operationKey) || statusCode >= 400) {
      this.auditService.log({
        action: `SECURITY_${statusCode < 400 ? 'SUCCESS' : 'FAILED'}_${method}_${url.replace(/\//g, '_').toUpperCase()}`,
        userId: context.userId,
        tenantId: context.tenantId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: {
          method,
          url: url.split('?')[0], // Remove query params
          statusCode,
          durationMs: duration,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  private logSecurityViolation(
    request: Request,
    error: any,
    context: { userId?: string; tenantId?: string; ipAddress: string; userAgent: string }
  ) {
    const method = request.method;
    const url = request.url;

    // Log violações de segurança
    this.auditService.log({
      action: `SECURITY_VIOLATION_${error.status || 500}_${method}_${url.replace(/\//g, '_').toUpperCase()}`,
      userId: context.userId,
      tenantId: context.tenantId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: {
        method,
        url: url.split('?')[0],
        error: error.message,
        statusCode: error.status || 500,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }

  private getClientIp(request: Request): string {
    // Ordem de prioridade para obter IP real
    return (
      request.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.get('x-real-ip') ||
      request.get('x-client-ip') ||
      request.ip ||
      'unknown'
    );
  }
}