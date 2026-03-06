import { Injectable, Logger } from '@nestjs/common';
import { BackupJobStatus, BackupJobType, Role } from '@prisma/client';
import Redis from 'ioredis';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SystemVersionService } from '../common/services/system-version.service';
import { MaintenanceModeService } from '../maintenance/maintenance-mode.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { ResponseTimeMetricsService } from './system-response-time-metrics.service';

type DashboardSeverity = 'all' | 'info' | 'warning' | 'critical';

export interface DashboardActor {
  userId: string;
  role: Role;
  tenantId?: string | null;
}

export interface DashboardFiltersInput {
  periodMinutes?: number;
  tenantId?: string;
  severity?: string;
}

export interface DashboardLayoutInput {
  layoutJson?: unknown;
  filtersJson?: unknown;
}

interface DashboardMetricFallback {
  status: 'unavailable';
  error: string;
}

type DashboardMetric<T extends Record<string, unknown>> = T | DashboardMetricFallback;

const DEFAULT_PERIOD_MINUTES = 60;
const MIN_PERIOD_MINUTES = 5;
const MAX_PERIOD_MINUTES = 24 * 60;
const MAX_JSON_STORAGE_LENGTH = 200_000;

const SUPER_ADMIN_WIDGET_IDS = [
  'version',
  'uptime',
  'maintenance',
  'api',
  'cpu',
  'memory',
  'disk',
  'system',
  'database',
  'redis',
  'workers',
  'jobs',
  'backup',
  'errors',
  'security',
  'tenants',
  'notifications',
];

const ADMIN_WIDGET_IDS = [
  'version',
  'uptime',
  'maintenance',
  'api',
  'cpu',
  'memory',
  'database',
  'jobs',
  'backup',
  'errors',
  'security',
  'notifications',
];

const BASIC_WIDGET_IDS = ['version', 'uptime', 'maintenance', 'api', 'notifications'];

@Injectable()
export class SystemDashboardService {
  private readonly logger = new Logger(SystemDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemVersionService: SystemVersionService,
    private readonly maintenanceModeService: MaintenanceModeService,
    private readonly responseTimeMetricsService: ResponseTimeMetricsService,
  ) {}

  async getDashboard(actor: DashboardActor, filtersInput: DashboardFiltersInput = {}) {
    const filters = this.normalizeFilters(filtersInput);
    const startedAt = Date.now();
    const now = new Date();
    const windowStart = new Date(now.getTime() - filters.periodMinutes * 60 * 1000);
    const tenantFilter = this.resolveTenantFilter(actor, filters.tenantId);

    const version = await this.safeMetric(
      'version',
      async () => this.getVersionMetric(),
    );
    const uptime = await this.safeMetric(
      'uptime',
      async () => this.getUptimeMetric(),
    );
    const maintenance = await this.safeMetric(
      'maintenance',
      async () => this.getMaintenanceMetric(),
    );
    const system = await this.safeMetric(
      'system',
      async () => this.getSystemMetric(),
    );
    const cpu = await this.safeMetric(
      'cpu',
      async () => this.getCpuMetric(),
    );
    const memory = await this.safeMetric(
      'memory',
      async () => this.getMemoryMetric(),
    );
    const disk = await this.safeMetric(
      'disk',
      async () => this.getDiskMetric(),
    );
    const database = await this.safeMetric(
      'database',
      async () => this.getDatabaseMetric(),
    );
    const redis = await this.safeMetric(
      'redis',
      async () => this.getRedisMetric(),
    );
    const workers = await this.safeMetric(
      'workers',
      async () => this.getWorkersMetric(),
    );
    const api = await this.safeMetric(
      'api',
      async () => this.getApiMetric(),
    );
    const security = await this.safeMetric(
      'security',
      async () => this.getSecurityMetric(windowStart, tenantFilter),
    );
    const backup = await this.safeMetric(
      'backup',
      async () => this.getBackupMetric(tenantFilter),
    );
    const jobs = await this.safeMetric(
      'jobs',
      async () => this.getJobsMetric(),
    );
    const errors = await this.safeMetric(
      'errors',
      async () => this.getRecentCriticalErrorsMetric(windowStart, tenantFilter, filters.severity),
    );
    const tenants = await this.safeMetric(
      'tenants',
      async () => this.getTenantsMetric(),
    );
    const notifications = await this.safeMetric(
      'notifications',
      async () => this.getNotificationsMetric(actor, windowStart),
    );

    const payload = {
      generatedAt: now.toISOString(),
      responseTimeMs: Date.now() - startedAt,
      filtersApplied: {
        periodMinutes: filters.periodMinutes,
        tenantId: tenantFilter || null,
        severity: filters.severity,
      },
      version,
      uptime,
      maintenance,
      system,
      cpu,
      memory,
      disk,
      database,
      redis,
      workers,
      api,
      security,
      backup,
      jobs,
      errors,
      tenants,
      notifications,
      widgets: {
        available: this.getAllowedWidgetIds(actor.role),
      },
    };

    return this.applyRoleProjection(payload, actor.role);
  }

  async getLayout(actor: DashboardActor) {
    const layout = await this.prisma.dashboardLayout.findUnique({
      where: {
        userId_role: {
          userId: actor.userId,
          role: actor.role,
        },
      },
      select: {
        id: true,
        role: true,
        layoutJson: true,
        filtersJson: true,
        updatedAt: true,
      },
    });

    if (!layout) {
      return {
        role: actor.role,
        layoutJson: this.getDefaultLayout(actor.role),
        filtersJson: this.getDefaultFilters(actor.role),
        updatedAt: null,
        resolution: this.buildLayoutResolution('role_default', actor),
      };
    }

    return {
      role: layout.role,
      layoutJson: this.normalizePersistedJson(layout.layoutJson, this.getDefaultLayout(actor.role)),
      filtersJson: this.normalizePersistedJson(layout.filtersJson, this.getDefaultFilters(actor.role)),
      updatedAt: layout.updatedAt.toISOString(),
      resolution: this.buildLayoutResolution('user_role', actor),
    };
  }

  async saveLayout(actor: DashboardActor, input: DashboardLayoutInput) {
    const layoutJson = this.sanitizeJson(input.layoutJson, this.getDefaultLayout(actor.role));
    const filtersJson = this.sanitizeJson(input.filtersJson, this.getDefaultFilters(actor.role));

    const saved = await this.prisma.dashboardLayout.upsert({
      where: {
        userId_role: {
          userId: actor.userId,
          role: actor.role,
        },
      },
      create: {
        userId: actor.userId,
        role: actor.role,
        layoutJson: layoutJson as any,
        filtersJson: filtersJson as any,
      },
      update: {
        layoutJson: layoutJson as any,
        filtersJson: filtersJson as any,
      },
      select: {
        role: true,
        layoutJson: true,
        filtersJson: true,
        updatedAt: true,
      },
    });

    return {
      role: saved.role,
      layoutJson: this.normalizePersistedJson(saved.layoutJson, this.getDefaultLayout(actor.role)),
      filtersJson: this.normalizePersistedJson(saved.filtersJson, this.getDefaultFilters(actor.role)),
      updatedAt: saved.updatedAt.toISOString(),
      resolution: this.buildLayoutResolution('user_role', actor),
    };
  }

  private async getVersionMetric() {
    const version = this.systemVersionService.getVersionInfo();
    return {
      status: 'ok' as const,
      version: version.version,
      commitSha: version.commitSha || null,
      buildDate: version.buildDate || null,
      branch: version.branch || null,
      source: version.source,
    };
  }

  private async getUptimeMetric() {
    const seconds = Math.floor(process.uptime());
    const startedAt = new Date(Date.now() - seconds * 1000).toISOString();
    return {
      status: 'ok' as const,
      seconds,
      human: this.formatDuration(seconds),
      startedAt,
    };
  }

  private async getMaintenanceMetric() {
    const state = await this.maintenanceModeService.getState();
    return {
      status: 'ok' as const,
      enabled: Boolean(state.enabled),
      reason: state.reason || null,
      etaSeconds: state.etaSeconds ?? null,
      startedAt: state.startedAt || null,
    };
  }

  private async getSystemMetric() {
    return {
      status: 'ok' as const,
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      nodeVersion: process.version,
      pid: process.pid,
    };
  }

  private async getCpuMetric() {
    const cores = os.cpus().length;
    const loadAvg = os.loadavg();
    const usagePercent = cores > 0 ? Math.min(100, Number(((loadAvg[0] / cores) * 100).toFixed(2))) : null;

    return {
      status: 'ok' as const,
      cores,
      loadAvg,
      usagePercent,
    };
  }

  private async getMemoryMetric() {
    const processMemory = process.memoryUsage();
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(2)) : null;

    return {
      status: 'ok' as const,
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent,
      process: {
        rssBytes: processMemory.rss,
        heapTotalBytes: processMemory.heapTotal,
        heapUsedBytes: processMemory.heapUsed,
        externalBytes: processMemory.external,
      },
    };
  }

  private async getDiskMetric() {
    const baseDir = path.resolve(process.env.APP_BASE_DIR || process.cwd());
    const stat = await fs.statfs(baseDir as any);

    const blockSize = Number(stat.bsize || 0);
    const blocks = Number(stat.blocks || 0);
    const availableBlocks = Number(stat.bavail || 0);

    const totalBytes = blockSize * blocks;
    const freeBytes = blockSize * availableBlocks;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(2)) : null;

    return {
      status: 'ok' as const,
      path: baseDir,
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent,
    };
  }

  private async getDatabaseMetric() {
    const startedAt = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startedAt;

    return {
      status: 'healthy' as const,
      latencyMs,
    };
  }

  private async getRedisMetric() {
    const host = String(process.env.REDIS_HOST || '').trim();
    const port = Number.parseInt(String(process.env.REDIS_PORT || '6379'), 10);
    const password = String(process.env.REDIS_PASSWORD || '').trim();
    const username = String(process.env.REDIS_USERNAME || '').trim();
    const db = Number.parseInt(String(process.env.REDIS_DB || '0'), 10);

    if (!host) {
      return {
        status: 'not_configured' as const,
        latencyMs: null,
      };
    }

    const redis = new Redis({
      host,
      port: Number.isFinite(port) ? port : 6379,
      username: username || undefined,
      password: password || undefined,
      db: Number.isFinite(db) ? db : 0,
      connectTimeout: 1500,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    try {
      const startedAt = Date.now();
      if (redis.status === 'wait') {
        await redis.connect();
      }
      const pong = await redis.ping();
      const latencyMs = Date.now() - startedAt;

      return {
        status: pong === 'PONG' ? ('healthy' as const) : ('degraded' as const),
        latencyMs,
      };
    } catch {
      return {
        status: 'down' as const,
        latencyMs: null,
      };
    } finally {
      try {
        await redis.quit();
      } catch {
        try {
          redis.disconnect();
        } catch {}
      }
    }
  }

  private async getWorkersMetric() {
    const [runningJobs, pendingJobs] = await Promise.all([
      this.prisma.backupJob.count({
        where: {
          status: BackupJobStatus.RUNNING,
        },
      }),
      this.prisma.backupJob.count({
        where: {
          status: BackupJobStatus.PENDING,
        },
      }),
    ]);

    return {
      status: 'ok' as const,
      activeWorkers: runningJobs,
      runningJobs,
      pendingJobs,
    };
  }

  private async getApiMetric() {
    const windowMs = 5 * 60 * 1000;
    const snapshot = this.responseTimeMetricsService.getAverageForWindow(windowMs, 'business');
    const byCategory = this.responseTimeMetricsService.getCategorizedAverages(windowMs);

    return {
      status: 'ok' as const,
      avgResponseTimeMs: snapshot.averageMs,
      sampleSize: snapshot.sampleSize,
      windowSeconds: Math.floor(snapshot.windowMs / 1000),
      scope: 'business' as const,
      byCategory,
    };
  }

  private async getSecurityMetric(windowStart: Date, tenantId?: string | null) {
    const deniedLogs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: windowStart,
        },
        ...(tenantId ? { tenantId } : {}),
        OR: [
          { action: { contains: 'DENIED' } },
          { action: { contains: 'BLOCKED' } },
          { action: { contains: 'UNAUTHORIZED' } },
          { action: 'RATE_LIMIT_BLOCKED' },
        ],
      },
      select: {
        ip: true,
        ipAddress: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 300,
    });

    const aggregate = new Map<string, { count: number; lastAt: string }>();

    for (const entry of deniedLogs) {
      const ip = String(entry.ip || entry.ipAddress || 'unknown').trim() || 'unknown';
      const previous = aggregate.get(ip);
      const isoTime = entry.createdAt.toISOString();
      if (!previous) {
        aggregate.set(ip, { count: 1, lastAt: isoTime });
        continue;
      }

      aggregate.set(ip, {
        count: previous.count + 1,
        lastAt: previous.lastAt > isoTime ? previous.lastAt : isoTime,
      });
    }

    const deniedAccess = Array.from(aggregate.entries())
      .map(([ip, data]) => ({
        ip,
        count: data.count,
        lastAt: data.lastAt,
      }))
      .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
      .slice(0, 10);

    return {
      status: 'ok' as const,
      deniedAccess,
      windowStart: windowStart.toISOString(),
    };
  }

  private async getBackupMetric(tenantId?: string | null) {
    const lastBackup = await this.prisma.backupJob.findFirst({
      where: {
        type: BackupJobType.BACKUP,
        status: BackupJobStatus.SUCCESS,
        ...(tenantId ? { createdByUser: { tenantId } } : {}),
      },
      select: {
        id: true,
        fileName: true,
        sizeBytes: true,
        startedAt: true,
        finishedAt: true,
        status: true,
        artifactId: true,
      },
      orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      status: 'ok' as const,
      lastBackup: lastBackup
        ? {
            id: lastBackup.id,
            artifactId: lastBackup.artifactId || null,
            fileName: lastBackup.fileName || null,
            status: lastBackup.status,
            sizeBytes: lastBackup.sizeBytes ? Number(lastBackup.sizeBytes) : null,
            startedAt: lastBackup.startedAt ? lastBackup.startedAt.toISOString() : null,
            finishedAt: lastBackup.finishedAt ? lastBackup.finishedAt.toISOString() : null,
            durationSeconds: this.calculateDurationSeconds(lastBackup.startedAt, lastBackup.finishedAt),
          }
        : null,
    };
  }

  private async getJobsMetric() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [running, pending, failedLast24h, lastFailure] = await Promise.all([
      this.prisma.backupJob.count({
        where: {
          status: BackupJobStatus.RUNNING,
        },
      }),
      this.prisma.backupJob.count({
        where: {
          status: BackupJobStatus.PENDING,
        },
      }),
      this.prisma.backupJob.count({
        where: {
          status: BackupJobStatus.FAILED,
          finishedAt: {
            gte: last24Hours,
          },
        },
      }),
      this.prisma.backupJob.findFirst({
        where: {
          status: BackupJobStatus.FAILED,
        },
        select: {
          id: true,
          type: true,
          finishedAt: true,
          error: true,
        },
        orderBy: [{ finishedAt: 'desc' }, { updatedAt: 'desc' }],
      }),
    ]);

    return {
      status: 'ok' as const,
      running,
      pending,
      failedLast24h,
      lastFailure: lastFailure
        ? {
            id: lastFailure.id,
            type: lastFailure.type,
            finishedAt: lastFailure.finishedAt ? lastFailure.finishedAt.toISOString() : null,
            error: this.truncateText(String(lastFailure.error || ''), 220),
          }
        : null,
    };
  }

  private async getRecentCriticalErrorsMetric(
    windowStart: Date,
    tenantId: string | null | undefined,
    severity: DashboardSeverity,
  ) {
    const effectiveSeverity = severity === 'all' ? 'critical' : severity;
    const where: any = {
      createdAt: {
        gte: windowStart,
      },
      severity: effectiveSeverity,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const criticalRows = await this.prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        message: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    return {
      status: 'ok' as const,
      recent: criticalRows.map((row) => ({
        id: row.id,
        action: row.action,
        message: this.truncateText(row.message || row.action, 220),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async getTenantsMetric() {
    const [active, total] = await Promise.all([
      this.prisma.tenant.count({
        where: {
          ativo: true,
        },
      }),
      this.prisma.tenant.count(),
    ]);

    return {
      status: 'ok' as const,
      active,
      total,
    };
  }

  private async getNotificationsMetric(actor: DashboardActor, windowStart: Date) {
    const scopeWhere = this.buildNotificationsScope(actor);
    const [criticalUnread, criticalRecent] = await Promise.all([
      this.prisma.notification.count({
        where: {
          ...scopeWhere,
          severity: 'critical',
          isRead: false,
        },
      }),
      this.prisma.notification.count({
        where: {
          ...scopeWhere,
          severity: 'critical',
          createdAt: {
            gte: windowStart,
          },
        },
      }),
    ]);

    return {
      status: 'ok' as const,
      criticalUnread,
      criticalRecent,
    };
  }

  private buildNotificationsScope(actor: DashboardActor): any {
    const role = String(actor.role || '').toUpperCase();
    const targetUserId = String(actor.userId || '').trim();
    const or: any[] = [];

    if (role) {
      or.push({ targetRole: role });
    }

    if (targetUserId) {
      or.push({ targetUserId });
    }

    if (role === 'SUPER_ADMIN') {
      or.push({ audience: 'super_admin' });
    }

    if (or.length === 0) {
      return { targetRole: 'SUPER_ADMIN' };
    }

    return { OR: or };
  }

  private getAllowedWidgetIds(role: Role): string[] {
    if (role === Role.SUPER_ADMIN) {
      return [...SUPER_ADMIN_WIDGET_IDS];
    }
    if (role === Role.ADMIN) {
      return [...ADMIN_WIDGET_IDS];
    }
    return [...BASIC_WIDGET_IDS];
  }

  private getDefaultLayout(role: Role): Record<string, unknown> {
    const widgetIds = this.getAllowedWidgetIds(role);
    return {
      lg: this.buildGridLayout(widgetIds, 4),
      md: this.buildGridLayout(widgetIds, 2),
      sm: this.buildGridLayout(widgetIds, 1),
    };
  }

  private getDefaultFilters(role: Role): Record<string, unknown> {
    return {
      periodMinutes: role === Role.SUPER_ADMIN ? DEFAULT_PERIOD_MINUTES : 30,
      tenantId: null,
      severity: 'all',
      hiddenWidgetIds: [],
    };
  }

  private buildGridLayout(widgetIds: string[], columns: number) {
    return widgetIds.map((id, index) => ({
      i: id,
      x: index % columns,
      y: Math.floor(index / columns),
      w: 1,
      h: 1,
      minW: 1,
      minH: 1,
    }));
  }

  private normalizeFilters(input: DashboardFiltersInput): {
    periodMinutes: number;
    tenantId: string | null;
    severity: DashboardSeverity;
  } {
    const periodRaw = Number(input.periodMinutes);
    const periodMinutes = Number.isFinite(periodRaw)
      ? Math.max(MIN_PERIOD_MINUTES, Math.min(MAX_PERIOD_MINUTES, Math.floor(periodRaw)))
      : DEFAULT_PERIOD_MINUTES;

    const tenantId = this.normalizeNullableString(input.tenantId);
    const severity = this.normalizeSeverity(input.severity);

    return {
      periodMinutes,
      tenantId,
      severity,
    };
  }

  private normalizeSeverity(input?: string): DashboardSeverity {
    const normalized = String(input || '')
      .trim()
      .toLowerCase();
    if (normalized === 'info' || normalized === 'warning' || normalized === 'critical') {
      return normalized;
    }
    return 'all';
  }

  private normalizeNullableString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private resolveTenantFilter(actor: DashboardActor, requestedTenantId: string | null): string | null {
    if (actor.role === Role.SUPER_ADMIN) {
      return requestedTenantId;
    }

    const actorTenantId = this.normalizeNullableString(actor.tenantId);
    return actorTenantId || null;
  }

  private applyRoleProjection(payload: Record<string, any>, role: Role): Record<string, any> {
    if (role === Role.SUPER_ADMIN) {
      return payload;
    }

    if (role === Role.ADMIN) {
      return {
        ...payload,
        system: this.pickIfAvailable(payload.system, ['status', 'platform', 'release', 'arch', 'nodeVersion']),
        disk: { status: 'restricted' },
        redis: this.pickIfAvailable(payload.redis, ['status', 'latencyMs']),
        workers: this.pickIfAvailable(payload.workers, ['status', 'runningJobs', 'pendingJobs']),
      };
    }

    return {
      ...payload,
      system: { status: 'restricted' },
      cpu: { status: 'restricted' },
      memory: { status: 'restricted' },
      disk: { status: 'restricted' },
      database: { status: 'restricted' },
      redis: { status: 'restricted' },
      workers: { status: 'restricted' },
      security: { status: 'restricted' },
      backup: { status: 'restricted' },
      jobs: { status: 'restricted' },
      errors: { status: 'restricted' },
      tenants: { status: 'restricted' },
    };
  }

  private pickIfAvailable(value: any, fields: string[]) {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const output: Record<string, unknown> = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(value, field)) {
        output[field] = value[field];
      }
    }
    return output;
  }

  private sanitizeJson(input: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return fallback;
    }

    try {
      const raw = JSON.stringify(input);
      if (!raw || raw.length > MAX_JSON_STORAGE_LENGTH) {
        return fallback;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return fallback;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return fallback;
    }
  }

  private normalizePersistedJson(
    input: unknown,
    fallback: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return fallback;
    }

    return input as Record<string, unknown>;
  }

  private buildLayoutResolution(source: 'user_role' | 'role_default', actor: DashboardActor) {
    return {
      source,
      key: {
        userId: actor.userId,
        role: actor.role,
      },
      precedence: ['user_role', 'role_default'],
      description:
        source === 'user_role'
          ? 'layout salvo para combinacao usuario+role'
          : 'fallback para layout padrao da role',
    };
  }

  private async safeMetric<T extends Record<string, unknown>>(
    metricName: string,
    producer: () => Promise<T>,
  ): Promise<DashboardMetric<T>> {
    try {
      return await producer();
    } catch (error) {
      const message = this.normalizeErrorMessage(error);
      this.logger.warn(`Falha ao coletar metrica ${metricName}: ${message}`);
      return {
        status: 'unavailable',
        error: message,
      };
    }
  }

  private formatDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(safeSeconds / 86400);
    const hours = Math.floor((safeSeconds % 86400) / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    const dayPrefix = days > 0 ? `${days}d ` : '';
    return `${dayPrefix}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      seconds,
    ).padStart(2, '0')}`;
  }

  private calculateDurationSeconds(startedAt?: Date | null, finishedAt?: Date | null): number | null {
    if (!startedAt || !finishedAt) {
      return null;
    }
    const diffMs = finishedAt.getTime() - startedAt.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) {
      return null;
    }
    return Math.max(0, Math.round(diffMs / 1000));
  }

  private normalizeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return this.truncateText(error.message, 180);
    }

    return this.truncateText(String(error), 180);
  }

  private truncateText(value: string, maxLength: number): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
  }
}
