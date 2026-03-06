import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { MaintenanceModeService, MaintenanceState } from './maintenance-mode.service';
import { AuditService } from '../audit/audit.service';
import { extractAuditContext } from '../audit/audit-request-context.util';
import { NotificationService } from '../notifications/notification.service';


@Injectable()
export class MaintenanceModeGuard implements CanActivate {
  private readonly logger = new Logger(MaintenanceModeGuard.name);

  constructor(
    private readonly maintenanceModeService: MaintenanceModeService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = this.normalizeMethod(request.method);
    const requestPath = this.normalizePath(request);

    if (method === 'OPTIONS') {
      return true;
    }

    const maintenance = await this.maintenanceModeService.getState();
    if (!maintenance.enabled) {
      return true;
    }

    if (this.isWhitelistedPath(method, requestPath)) {
      return true;
    }

    if (await this.canBypass(request, maintenance, method, requestPath)) {
      return true;
    }

    throw new ServiceUnavailableException({
      error: 'MAINTENANCE_MODE',
      message: 'Sistema em manutencao. Tente novamente em alguns minutos.',
      reason: maintenance.reason || 'maintenance',
      etaSeconds: maintenance.etaSeconds,
    });
  }

  private isWhitelistedPath(method: string, requestPath: string): boolean {
    if ((method === 'GET' || method === 'HEAD') && this.matchesPath(requestPath, '/api/health')) {
      return true;
    }

    if (method === 'GET' && this.matchesPath(requestPath, '/api/system/maintenance/state')) {
      return true;
    }

    if (method === 'GET' && this.matchesPath(requestPath, '/api/system/version')) {
      return true;
    }

    if (method === 'GET' && this.matchesPath(requestPath, '/api/system/update/status')) {
      return true;
    }

    if (method === 'GET' && this.matchesPath(requestPath, '/api/system/update/log')) {
      return true;
    }

    if (method === 'POST' && this.matchesPath(requestPath, '/api/system/update/run')) {
      return true;
    }

    if (method === 'POST' && this.matchesPath(requestPath, '/api/system/update/rollback')) {
      return true;
    }

    if (method === 'GET' && this.matchesPath(requestPath, '/api/system/update/releases')) {
      return true;
    }

    if (
      (method === 'GET' || method === 'POST') &&
      this.matchesPath(requestPath, '/api/system/notifications')
    ) {
      return true;
    }

    if (method === 'POST' && this.matchesPath(requestPath, '/api/auth/login')) {
      return true;
    }

    if (method === 'POST' && this.matchesPath(requestPath, '/api/auth/login-2fa')) {
      return true;
    }

    if (method === 'POST' && this.matchesPath(requestPath, '/api/auth/refresh')) {
      return true;
    }

    if (method === 'GET' && this.matchesPath(requestPath, '/api/tenants/public')) {
      return true;
    }

    return false;
  }

  private async canBypass(
    request: Request,
    maintenance: MaintenanceState,
    method: string,
    requestPath: string,
  ): Promise<boolean> {
    const expectedBypassToken = String(process.env.MAINTENANCE_BYPASS_TOKEN || '').trim();
    if (!expectedBypassToken) {
      return false;
    }

    const headerName = String(maintenance.bypassHeader || 'X-Maintenance-Bypass').trim().toLowerCase();
    const providedBypassToken = this.readHeader(request, headerName);

    if (!providedBypassToken || providedBypassToken !== expectedBypassToken) {
      return false;
    }

    const allowedRoles = this.normalizeAllowedRoles(maintenance.allowedRoles);

    const roleFromRequest = String((request as any)?.user?.role || '').trim().toUpperCase();
    if (this.hasBypassRole(roleFromRequest, allowedRoles)) {
      await this.logBypassUsage(request, method, requestPath, (request as any)?.user);
      return true;
    }

    const jwtSecret = String(process.env.JWT_SECRET || '').trim();
    if (!jwtSecret) {
      this.logger.warn('JWT_SECRET ausente; bypass de maintenance foi negado.');
      return false;
    }

    const token = this.extractBearerToken(request);
    if (!token) {
      return false;
    }

    try {
      const payload = this.jwtService.verify<{ role?: string }>(token, {
        secret: jwtSecret,
      });
      const role = String(payload?.role || '').trim().toUpperCase();
      if (!this.hasBypassRole(role, allowedRoles)) {
        return false;
      }

      await this.logBypassUsage(request, method, requestPath, payload);
      return true;
    } catch {
      return false;
    }
  }

  private matchesPath(actualPath: string, expectedBasePath: string): boolean {
    return actualPath === expectedBasePath || actualPath.startsWith(`${expectedBasePath}/`);
  }

  private normalizePath(request: Request): string {
    const rawPath = String(
      request.originalUrl || (request as any).url || (request as any).path || '/',
    );
    const [pathWithoutQuery] = rawPath.split('?');
    const normalized = pathWithoutQuery.trim().toLowerCase();
    return normalized.length > 0 ? normalized : '/';
  }

  private normalizeMethod(method: string): string {
    const normalized = String(method || '').trim().toUpperCase();
    return normalized.length > 0 ? normalized : 'GET';
  }

  private readHeader(request: Request, headerName: string): string | null {
    const value = request.headers?.[headerName as keyof typeof request.headers];
    const headerValue = Array.isArray(value) ? value[0] : value;
    if (typeof headerValue !== 'string') {
      return null;
    }

    const normalized = headerValue.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = this.readHeader(request, 'authorization');
    if (!authHeader) {
      return null;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return null;
    }

    const token = String(match[1] || '').trim();
    return token.length > 0 ? token : null;
  }

  private normalizeAllowedRoles(input: unknown): string[] {
    if (!Array.isArray(input)) {
      return ['SUPER_ADMIN'];
    }

    const normalized = input
      .map((role) => String(role || '').trim().toUpperCase())
      .filter((role) => role.length > 0);

    return normalized.length > 0 ? normalized : ['SUPER_ADMIN'];
  }

  private hasBypassRole(role: string, allowedRoles: string[]): boolean {
    if (!role) {
      return false;
    }
    return allowedRoles.includes(role);
  }

  private async logBypassUsage(
    request: Request,
    method: string,
    requestPath: string,
    userPayload: any,
  ): Promise<void> {
    const role = String(userPayload?.role || '').trim().toUpperCase();
    if (role !== 'SUPER_ADMIN') {
      return;
    }

    const { actor, requestCtx, tenantId } = extractAuditContext({
      headers: request.headers,
      ip: (request as any).ip,
      socket: (request as any).socket,
      user: {
        id: userPayload?.id || userPayload?.sub,
        sub: userPayload?.sub || userPayload?.id,
        email: userPayload?.email,
        role,
        tenantId: userPayload?.tenantId,
      },
    });

    await this.auditService.log({
      action: 'MAINTENANCE_BYPASS_USED',
      severity: 'critical',
      message: `Bypass de manutencao usado por SUPER_ADMIN em ${method} ${requestPath}`,
      actor,
      requestCtx,
      tenantId: tenantId || undefined,
      metadata: {
        route: requestPath,
        method,
      },
    });

    await this.notificationService.emitSystemAlert({
      action: 'MAINTENANCE_BYPASS_USED',
      severity: 'critical',
      title: 'Bypass de manutencao utilizado',
      body: `SUPER_ADMIN utilizou bypass de manutencao em ${method} ${requestPath}.`,
      data: {
        route: requestPath,
        method,
      },
      module: 'maintenance',
    });
  }
}
