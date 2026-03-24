import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { RequestSecurityContextService } from '../common/services/request-security-context.service';
import { RateLimitMetricsService, RateLimitStatsParams } from '../common/services/rate-limit-metrics.service';
import { humanizeAuditAction, resolveAuditDisplayMessage } from './audit-log-presentation.util';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditActor {
  userId?: string;
  email?: string;
  role?: string;
}

export interface AuditRequestContext {
  ip?: string;
  userAgent?: string;
}

export interface AuditLogData {
  action: string;
  severity?: AuditSeverity | string;
  message?: string;
  actor?: AuditActor;
  requestCtx?: AuditRequestContext;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuditLogListParams {
  page?: number;
  limit?: number;
  action?: string;
  allowedActionPrefixes?: string[];
  severity?: string;
  actorUserId?: string;
  userId?: string;
  tenantId?: string;
  from?: Date;
  to?: Date;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private prisma: PrismaService,
    private readonly rateLimitMetricsService: RateLimitMetricsService,
    private readonly requestSecurityContext: RequestSecurityContextService,
  ) {}

  /**
   * Cria log de auditoria estruturado (retrocompativel com payload legado).
   */
  async log(data: AuditLogData) {
    const action = this.normalizeAction(data.action);
    const actorUserId = this.normalizeString(data.actor?.userId || data.userId);
    const actorEmail = this.normalizeString(data.actor?.email);
    const actorRole = this.normalizeString(data.actor?.role);
    const tenantId = this.normalizeString(data.tenantId);
    const request = this.requestSecurityContext.getRequest();
    const realIp = request?.headers?.['x-real-ip'];
    const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
    const ip = this.normalizeString(realIpValue || data.requestCtx?.ip || data.ipAddress);
    const userAgent = this.normalizeString(data.requestCtx?.userAgent || data.userAgent);
    const severity = this.normalizeSeverity(data.severity);
    const metadata = this.sanitizeMetadata(data.metadata || data.details || {});
    const details = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
    const message = this.normalizeMessage(data.message, action);

    try {
      return await this.prisma.auditLog.create({
        data: {
          action,
          severity,
          message,
          userId: actorUserId,
          actorUserId,
          actorEmail,
          actorRole,
          tenantId,
          ip,
          ipAddress: ip,
          userAgent,
          details,
          metadata: metadata as any,
        },
      });
    } catch (error) {
      this.logger.error(`Falha ao persistir auditoria action=${action}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Buscar logs com filtros e paginacao
   */
  async findAll(params: AuditLogListParams) {
    const page = this.clamp(this.toPositiveInt(params.page, 1), 1, 100000);
    const limit = this.clamp(this.toPositiveInt(params.limit, 20), 1, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    const allowedActionPrefixes = this.normalizeActionPrefixes(params.allowedActionPrefixes);

    const action = this.normalizeString(params.action);
    if (action && allowedActionPrefixes.length > 0 && !allowedActionPrefixes.some((prefix) => action.toUpperCase().startsWith(prefix))) {
      return this.emptyList(page, limit);
    }

    if (action) {
      where.action = action.toUpperCase();
    }

    if (allowedActionPrefixes.length > 0) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: allowedActionPrefixes.map((prefix) => ({
          action: { startsWith: prefix },
        })),
      });
    }

    const severity = this.normalizeSeverityFilter(params.severity);
    if (severity) {
      where.severity = severity;
    }

    const actorUserId = this.normalizeString(params.actorUserId || params.userId);
    if (actorUserId) {
      where.OR = [{ actorUserId }, { userId: actorUserId }];
    }

    const tenantId = this.normalizeString(params.tenantId);
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const from = params.from || params.startDate;
    const to = params.to || params.endDate;
    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = from;
      }
      if (to) {
        where.createdAt.lte = to;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => this.sanitizeAuditLogRow(log)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private emptyList(page: number, limit: number) {
    return {
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    };
  }

  /**
   * Buscar log por ID
   */
  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return log ? this.sanitizeAuditLogRow(log) : null;
  }

  /**
   * Estatisticas de logs
   */
  async getStats(params: { startDate?: Date; endDate?: Date; tenantId?: string }) {
    const where: any = {};

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    if (params.tenantId) {
      where.tenantId = params.tenantId;
    }

    const [total, byAction, byUser] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
        _count: true,
        orderBy: {
          _count: {
            userId: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    return {
      total,
      byAction: byAction.map((item) => ({
        action: item.action,
        actionLabel: humanizeAuditAction(item.action),
        count: item._count,
      })),
      byUser: byUser.map((item) => ({
        userId: item.userId,
        count: item._count,
      })),
    };
  }

  async getStatsByActionPrefixes(params: {
    allowedActionPrefixes?: string[];
    startDate?: Date;
    endDate?: Date;
    tenantId?: string;
  }) {
    const where: any = {};
    const allowedActionPrefixes = this.normalizeActionPrefixes(params.allowedActionPrefixes);

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    if (params.tenantId) {
      where.tenantId = params.tenantId;
    }

    if (allowedActionPrefixes.length > 0) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: allowedActionPrefixes.map((prefix) => ({
          action: { startsWith: prefix },
        })),
      });
    }

    const [total, byAction, byUser] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
        _count: true,
        orderBy: {
          _count: {
            userId: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    return {
      total,
      byAction: byAction.map((item) => ({
        action: item.action,
        actionLabel: humanizeAuditAction(item.action),
        count: item._count,
      })),
      byUser: byUser.map((item) => ({
        userId: item.userId,
        count: item._count,
      })),
    };
  }

  async getRateLimitStats(params: RateLimitStatsParams = {}) {
    return this.rateLimitMetricsService.getStats(params);
  }

  async findRateLimitBlockedEvents(params: {
    page?: number;
    limit?: number;
    tenantId?: string;
    userId?: string;
    hours?: number;
  }) {
    const page = this.clamp(this.toPositiveInt(params.page, 1), 1, 100000);
    const limit = this.clamp(this.toPositiveInt(params.limit, 50), 1, 200);
    const hours = this.clamp(this.toPositiveInt(params.hours, 24), 1, 168);
    const skip = (page - 1) * limit;
    const startDate = new Date(Date.now() - hours * 3600 * 1000);

    const where: any = {
      action: 'RATE_LIMIT_BLOCKED',
      createdAt: {
        gte: startDate,
      },
    };

    if (params.tenantId) {
      where.tenantId = params.tenantId;
    }

    if (params.userId) {
      where.userId = params.userId;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const data = logs.map((log) => ({
      ...log,
      details: this.parseDetails(log.details),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        windowHours: hours,
        startDate,
      },
    };
  }

  private normalizeSeverity(input?: string): AuditSeverity {
    const value = String(input || '').trim().toLowerCase();
    if (value === 'critical') {
      return 'critical';
    }
    if (value === 'warning' || value === 'warn') {
      return 'warning';
    }
    return 'info';
  }

  private normalizeActionPrefixes(input?: string[]): string[] {
    if (!Array.isArray(input) || input.length === 0) {
      return [];
    }

    const normalized = input
      .map((prefix) => String(prefix || '').trim().toUpperCase())
      .filter((prefix) => prefix.length > 0);

    return [...new Set(normalized)];
  }

  private normalizeSeverityFilter(input?: string): AuditSeverity | null {
    if (!input) {
      return null;
    }

    const value = String(input || '').trim().toLowerCase();
    if (value === 'info' || value === 'warning' || value === 'warn' || value === 'critical') {
      return this.normalizeSeverity(value);
    }

    return null;
  }

  private normalizeAction(input: string): string {
    const normalized = String(input || '').trim().toUpperCase();
    return normalized || 'AUDIT_EVENT';
  }

  private normalizeMessage(input: string | undefined, action: string): string {
    const normalized = resolveAuditDisplayMessage(action, input);
    return normalized.slice(0, 300);
  }

  private normalizeString(input: unknown): string | null {
    if (typeof input !== 'string') {
      return null;
    }

    const normalized = input.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private sanitizeMetadata(input: Record<string, unknown>): Record<string, unknown> {
    const sanitized = this.sanitizeValue(input, 0, null);
    if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
      return {};
    }
    return sanitized as Record<string, unknown>;
  }

  private sanitizeValue(value: unknown, depth: number, key: string | null): unknown {
    if (depth >= 6) {
      return '[truncated]';
    }

    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.slice(0, 100).map((entry) => this.sanitizeValue(entry, depth + 1, key));
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
        if (this.shouldStoreAsCaptureFlag(entryKey, entryValue)) {
          result[this.toCapturedFlagKey(entryKey)] = true;
          continue;
        }

        if (this.isSensitiveKey(entryKey)) {
          result[entryKey] = '[redacted]';
          continue;
        }

        if (this.isHeadersKey(entryKey) && entryValue && typeof entryValue === 'object' && !Array.isArray(entryValue)) {
          result[entryKey] = this.sanitizeHeaders(entryValue as Record<string, unknown>, depth + 1);
          continue;
        }

        result[entryKey] = this.sanitizeValue(entryValue, depth + 1, entryKey);
      }
      return result;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }

      if (this.isSensitiveValue(trimmed, key)) {
        return '[redacted]';
      }

      let sanitized = this.redactSensitiveFragments(trimmed);

      if (key && this.isPathKey(key) && this.looksLikePath(sanitized)) {
        if (this.isSensitivePathKey(key) || this.looksSensitivePath(sanitized)) {
          return '[path-redacted]';
        }
        return this.sanitizePath(sanitized);
      }

      sanitized = this.looksSensitivePath(sanitized) ? '[path-redacted]' : sanitized;

      return sanitized.length > 1000 ? `${sanitized.slice(0, 997)}...` : sanitized;
    }

    return value;
  }

  private isSensitiveKey(key: string): boolean {
    return /(token|secret|password|authorization|cookie|api[-_]?key|private[-_]?key|database[_-]?url|connection|set-cookie|x-auth|x-access-token)/i.test(
      key,
    );
  }

  private isPathKey(key: string): boolean {
    return /(path|file|directory|dir|env)/i.test(key);
  }

  private isSensitiveValue(value: string, key: string | null): boolean {
    if (/^-----BEGIN [A-Z ]+-----/.test(value)) {
      return true;
    }

    if (key && this.isSensitiveHeaderName(key)) {
      return true;
    }

    if (/^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(value)) {
      return true;
    }

    if (/(postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^:\s/]+:[^@\s/]+@/i.test(value)) {
      return true;
    }

    return false;
  }

  private sanitizePath(value: string): string {
    const normalized = value.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0) {
      return '[path-redacted]';
    }

    return `[path-redacted]/${segments[segments.length - 1]}`;
  }

  private sanitizeHeaders(headers: Record<string, unknown>, depth: number): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [headerName, headerValue] of Object.entries(headers)) {
      if (this.isSensitiveHeaderName(headerName)) {
        sanitized[headerName] = '[redacted]';
        continue;
      }

      sanitized[headerName] = this.sanitizeValue(headerValue, depth + 1, headerName);
    }

    return sanitized;
  }

  private isHeadersKey(key: string): boolean {
    return /(headers|requestheaders|responseheaders)/i.test(key);
  }

  private isSensitiveHeaderName(headerName: string): boolean {
    return /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-access-token|x-refresh-token|x-csrf-token|x-xsrf-token)$/i.test(
      headerName.trim(),
    );
  }

  private isSensitivePathKey(key: string): boolean {
    return /(env|secret|credential|private|token|key|snapshot|pem|p12|pfx)/i.test(key);
  }

  private looksLikePath(value: string): boolean {
    return /[\\/]/.test(value);
  }

  private looksSensitivePath(value: string): boolean {
    return /(^|[\\/])\.env([./\\]|$)|([\\/])(secrets?|credentials?|private|keys?|\.ssh)([\\/]|$)|id_rsa|\.pem\b|\.p12\b|\.pfx\b|\.key\b/i.test(
      value,
    );
  }

  private shouldStoreAsCaptureFlag(key: string, value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    if (!this.looksLikePath(value.trim())) {
      return false;
    }

    return /(env.*snapshot.*(path|file)|snapshot.*env.*(path|file)|envSnapshotPath)/i.test(key);
  }

  private toCapturedFlagKey(key: string): string {
    const base = key.replace(/(file(path)?|path|directory|dir)$/i, '');
    const normalizedBase = base.trim() || key;
    return /captured$/i.test(normalizedBase) ? normalizedBase : `${normalizedBase}Captured`;
  }

  private redactSensitiveFragments(value: string): string {
    let sanitized = value;

    sanitized = sanitized.replace(/\b(Bearer)\s+[A-Za-z0-9\-._~+/=]+/gi, '$1 [redacted]');
    sanitized = sanitized.replace(
      /\b(authorization|proxy-authorization|token|secret|password|passwd|api[-_]?key|x-api-key|cookie|set-cookie|database_url)\b\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[redacted]',
    );
    sanitized = sanitized.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[redacted-jwt]');
    sanitized = sanitized.replace(
      /((?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^:\s/]+:)([^@\s/]+)@/gi,
      '$1[redacted]@',
    );
    sanitized = sanitized.replace(/([A-Za-z]:)?[\\/][^\s'"`]*\.env(?:\.[^\s'"`]*)?/gi, '[path-redacted]');

    return sanitized;
  }

  private parseDetails(value: string | null) {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return { raw: value };
    }
  }

  private toPositiveInt(value: number | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    return fallback;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private sanitizeAuditLogRow(log: any) {
    const parsedDetails = this.parseDetails(typeof log.details === 'string' ? log.details : null);
    const metadataInput = this.normalizeMetadataInput(log.metadata);
    const actionLabel = humanizeAuditAction(log.action);
    const message = resolveAuditDisplayMessage(log.action, log.message);

    return {
      ...log,
      actionLabel,
      message,
      details:
        parsedDetails && typeof parsedDetails === 'object' && !Array.isArray(parsedDetails)
          ? this.sanitizeMetadata(parsedDetails as Record<string, unknown>)
          : parsedDetails,
      metadata: this.sanitizeMetadata(metadataInput),
    };
  }

  private normalizeMetadataInput(value: unknown): Record<string, unknown> {
    if (!value) {
      return {};
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
      return {};
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}

