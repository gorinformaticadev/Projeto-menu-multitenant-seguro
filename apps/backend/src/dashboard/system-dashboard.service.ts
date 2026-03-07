import { Injectable, Logger } from '@nestjs/common';
import { BackupJobStatus, BackupJobType, Role } from '@prisma/client';
import Redis from 'ioredis';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { humanizeAuditAction, resolveAuditDisplayMessage } from '../audit/audit-log-presentation.util';
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
  status: 'error' | 'degraded' | 'unavailable';
  error: string;
}

type DashboardMetric<T extends Record<string, unknown>> = T | DashboardMetricFallback;
type DashboardLayoutBreakpoint = 'lg' | 'md' | 'sm';
interface DashboardHistoryPoint {
  at: string;
  value: number | null;
  sampleSize?: number;
  rssBytes?: number;
  heapUsedBytes?: number;
}
interface MemoryHistoryEntry {
  recordedAt: number;
  usedPercent: number | null;
  rssBytes: number;
  heapUsedBytes: number;
}

interface DashboardMetricCacheEntry {
  expiresAt: number;
  value: DashboardMetric<Record<string, unknown>>;
}

interface SafeMetricOptions {
  cacheKey?: string;
  cacheTtlMs?: number;
  fallbackStatus?: DashboardMetricFallback['status'];
}

const DEFAULT_PERIOD_MINUTES = 60;
const MIN_PERIOD_MINUTES = 5;
const MAX_PERIOD_MINUTES = 24 * 60;
const MAX_JSON_STORAGE_LENGTH = 200_000;
const DASHBOARD_LAYOUT_BREAKPOINTS: DashboardLayoutBreakpoint[] = ['lg', 'md', 'sm'];
const DASHBOARD_METRIC_CACHE_MAX_ENTRIES = 64;
const API_HISTORY_BUCKETS = 12;
const API_HISTORY_MAX_WINDOW_MINUTES = 15;
const MEMORY_HISTORY_RETENTION_MS = 5 * 60 * 1000;
const MEMORY_HISTORY_MAX_POINTS = 30;
const RECENT_BACKUPS_LIMIT = 10;
const RECENT_JOB_FAILURES_LIMIT = 20;
const RECENT_CRITICAL_ERRORS_LIMIT = 20;

// Curto cache em memoria para widgets caros/externos no polling do agregado.
// Nao cacheamos maintenance, uptime, notifications nem version para manter o estado mais fresco.
// Alem do TTL curto, limitamos o cache para evitar crescimento descontrolado
// em combinacoes de tenant/filtros no polling.
const DASHBOARD_CACHED_METRIC_TTLS = {
  redis: 10_000,
  workers: 10_000,
  jobs: 10_000,
  backup: 10_000,
  security: 10_000,
  errors: 10_000,
} as const;

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

const ROLE_WIDGET_POLICY: Record<Role, string[]> = {
  [Role.SUPER_ADMIN]: [...SUPER_ADMIN_WIDGET_IDS],
  [Role.ADMIN]: [...ADMIN_WIDGET_IDS],
  [Role.USER]: [...BASIC_WIDGET_IDS],
  [Role.CLIENT]: [...BASIC_WIDGET_IDS],
};

@Injectable()
export class SystemDashboardService {
  private readonly logger = new Logger(SystemDashboardService.name);
  private readonly metricCache = new Map<string, DashboardMetricCacheEntry>();
  // Historico leve em memoria para memoria do processo/sistema.
  // Mantemos janela curta e tamanho fixo para nao crescer indefinidamente.
  private readonly memoryHistory: MemoryHistoryEntry[] = [];

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
    const apiHistoryWindowMs = this.resolveApiHistoryWindowMs(filters.periodMinutes);

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
      { fallbackStatus: 'error' },
    );
    const redis = await this.safeMetric(
      'redis',
      async () => this.getRedisMetric(),
      {
        cacheKey: 'redis',
        cacheTtlMs: DASHBOARD_CACHED_METRIC_TTLS.redis,
        fallbackStatus: 'error',
      },
    );
    const workers = await this.safeMetric(
      'workers',
      async () => this.getWorkersMetric(),
      {
        cacheKey: 'workers',
        cacheTtlMs: DASHBOARD_CACHED_METRIC_TTLS.workers,
        fallbackStatus: 'error',
      },
    );
    const api = await this.safeMetric(
      'api',
      async () => this.getApiMetric(apiHistoryWindowMs),
    );
    const security = await this.safeMetric(
      'security',
      async () => this.getSecurityMetric(windowStart, tenantFilter),
      {
        cacheKey: `security:${filters.periodMinutes}:${tenantFilter || 'all'}`,
        cacheTtlMs: DASHBOARD_CACHED_METRIC_TTLS.security,
        fallbackStatus: 'degraded',
      },
    );
    const backup = await this.safeMetric(
      'backup',
      async () => this.getBackupMetric(tenantFilter),
      {
        cacheKey: `backup:${tenantFilter || 'all'}`,
        cacheTtlMs: DASHBOARD_CACHED_METRIC_TTLS.backup,
        fallbackStatus: 'degraded',
      },
    );
    const jobs = await this.safeMetric(
      'jobs',
      async () => this.getJobsMetric(),
      {
        cacheKey: 'jobs',
        cacheTtlMs: DASHBOARD_CACHED_METRIC_TTLS.jobs,
        fallbackStatus: 'degraded',
      },
    );
    const errors = await this.safeMetric(
      'errors',
      async () => this.getRecentCriticalErrorsMetric(windowStart, tenantFilter, filters.severity),
      {
        cacheKey: `errors:${filters.periodMinutes}:${tenantFilter || 'all'}:${filters.severity}`,
        cacheTtlMs: DASHBOARD_CACHED_METRIC_TTLS.errors,
        fallbackStatus: 'degraded',
      },
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
      layoutJson: this.sanitizeLayoutJsonForRole(layout.layoutJson, actor.role),
      filtersJson: this.sanitizeFiltersJsonForRole(layout.filtersJson, actor.role),
      updatedAt: layout.updatedAt.toISOString(),
      resolution: this.buildLayoutResolution('user_role', actor),
    };
  }

  async saveLayout(actor: DashboardActor, input: DashboardLayoutInput) {
    const layoutJson = this.sanitizeLayoutJsonForRole(input.layoutJson, actor.role);
    const filtersJson = this.sanitizeFiltersJsonForRole(input.filtersJson, actor.role);

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
      layoutJson: this.sanitizeLayoutJsonForRole(saved.layoutJson, actor.role),
      filtersJson: this.sanitizeFiltersJsonForRole(saved.filtersJson, actor.role),
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

    this.recordMemoryHistorySample({
      recordedAt: Date.now(),
      usedPercent,
      rssBytes: processMemory.rss,
      heapUsedBytes: processMemory.heapUsed,
    });

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
      history: this.getMemoryHistorySeries(),
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

  private async getApiMetric(historyWindowMs: number) {
    const windowMs = 5 * 60 * 1000;
    const snapshot = this.responseTimeMetricsService.getAverageForWindow(windowMs, 'business');
    const byCategory = this.responseTimeMetricsService.getCategorizedAverages(windowMs);
    const history = this.responseTimeMetricsService
      .getSeriesForWindow(historyWindowMs, 'business', API_HISTORY_BUCKETS)
      .map((point) => ({
        at: new Date(point.at).toISOString(),
        value: point.averageMs,
        sampleSize: point.sampleSize,
      }));

    return {
      status: 'ok' as const,
      avgResponseTimeMs: snapshot.averageMs,
      sampleSize: snapshot.sampleSize,
      windowSeconds: Math.floor(snapshot.windowMs / 1000),
      historyWindowSeconds: Math.floor(historyWindowMs / 1000),
      scope: 'business' as const,
      byCategory,
      history,
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
    const backupRows = await this.prisma.backupJob.findMany({
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
      take: RECENT_BACKUPS_LIMIT,
    });
    const recentBackups = backupRows.map((backup) => this.mapBackupSummary(backup));

    return {
      status: 'ok' as const,
      lastBackup: recentBackups[0] || null,
      recentBackups,
    };
  }

  private async getJobsMetric() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [running, pending, failedLast24h, recentFailureRows] = await Promise.all([
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
      this.prisma.backupJob.findMany({
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
        take: RECENT_JOB_FAILURES_LIMIT,
      }),
    ]);
    const recentFailures = recentFailureRows.map((failure) => this.mapJobFailureSummary(failure));

    return {
      status: 'ok' as const,
      running,
      pending,
      failedLast24h,
      lastFailure: recentFailures[0] || null,
      recentFailures,
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
      take: RECENT_CRITICAL_ERRORS_LIMIT,
    });

    return {
      status: 'ok' as const,
      recent: criticalRows.map((row) => ({
        id: row.id,
        action: row.action,
        actionLabel: humanizeAuditAction(row.action),
        message: this.truncateText(resolveAuditDisplayMessage(row.action, row.message), 220),
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
    return [...(ROLE_WIDGET_POLICY[role] || ROLE_WIDGET_POLICY[Role.CLIENT])];
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
        system: this.pickIfAvailable(payload.system, ['status', 'platform', 'release', 'arch', 'nodeVersion', 'error']),
        disk: { status: 'restricted' },
        redis: this.pickIfAvailable(payload.redis, ['status', 'latencyMs', 'error']),
        workers: this.pickIfAvailable(payload.workers, ['status', 'runningJobs', 'pendingJobs', 'error']),
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

  private sanitizeLayoutJsonForRole(
    input: unknown,
    role: Role,
  ): Record<string, unknown> {
    const fallback = this.getDefaultLayout(role);
    const parsed = this.sanitizeJson(input, fallback);
    const allowedWidgetIds = new Set(this.getAllowedWidgetIds(role));
    const sanitized: Record<string, unknown> = {};

    for (const breakpoint of DASHBOARD_LAYOUT_BREAKPOINTS) {
      const fallbackEntries = Array.isArray(fallback[breakpoint]) ? fallback[breakpoint] : [];
      const sourceEntries = Array.isArray(parsed[breakpoint]) ? parsed[breakpoint] : fallbackEntries;
      sanitized[breakpoint] = sourceEntries.filter((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return false;
        }

        const widgetId = String((entry as Record<string, unknown>).i || '').trim();
        return allowedWidgetIds.has(widgetId);
      });
    }

    return sanitized;
  }

  private sanitizeFiltersJsonForRole(input: unknown, role: Role): Record<string, unknown> {
    const fallback = this.getDefaultFilters(role);
    const parsed = this.sanitizeJson(input, fallback);
    const normalized = this.normalizeFilters({
      periodMinutes: parsed.periodMinutes as number | undefined,
      tenantId: role === Role.SUPER_ADMIN ? (parsed.tenantId as string | undefined) : undefined,
      severity: parsed.severity as string | undefined,
    });
    const allowedWidgetIds = new Set(this.getAllowedWidgetIds(role));
    const hiddenWidgetIds = Array.isArray(parsed.hiddenWidgetIds)
      ? parsed.hiddenWidgetIds
          .map((item) => String(item || '').trim())
          .filter((item) => item.length > 0 && allowedWidgetIds.has(item))
      : [];

    return {
      periodMinutes: normalized.periodMinutes,
      tenantId: role === Role.SUPER_ADMIN ? normalized.tenantId : null,
      severity: normalized.severity,
      hiddenWidgetIds,
    };
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
    options: SafeMetricOptions = {},
  ): Promise<DashboardMetric<T>> {
    const cached = this.readCachedMetric<T>(options.cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const metric = await producer();
      this.writeCachedMetric(options.cacheKey, options.cacheTtlMs, metric);
      return metric;
    } catch (error) {
      const message = this.normalizeErrorMessage(error);
      this.logger.warn(`Falha ao coletar metrica ${metricName}: ${message}`);
      const fallback: DashboardMetricFallback = {
        status: options.fallbackStatus || 'unavailable',
        error: message,
      };
      this.writeCachedMetric(options.cacheKey, options.cacheTtlMs, fallback);
      return fallback;
    }
  }

  private readCachedMetric<T extends Record<string, unknown>>(cacheKey?: string): DashboardMetric<T> | null {
    if (!cacheKey) {
      return null;
    }

    this.pruneExpiredMetricCacheEntries();

    const entry = this.metricCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.metricCache.delete(cacheKey);
      return null;
    }

    return entry.value as DashboardMetric<T>;
  }

  private writeCachedMetric<T extends Record<string, unknown>>(
    cacheKey: string | undefined,
    cacheTtlMs: number | undefined,
    value: DashboardMetric<T>,
  ) {
    if (!cacheKey || !cacheTtlMs || cacheTtlMs <= 0) {
      return;
    }

    const now = Date.now();
    this.pruneExpiredMetricCacheEntries(now);
    this.metricCache.set(cacheKey, {
      expiresAt: now + cacheTtlMs,
      value: value as DashboardMetric<Record<string, unknown>>,
    });
    this.trimMetricCacheToLimit();
  }

  private pruneExpiredMetricCacheEntries(now = Date.now()) {
    for (const [cacheKey, entry] of this.metricCache.entries()) {
      if (entry.expiresAt <= now) {
        this.metricCache.delete(cacheKey);
      }
    }
  }

  private trimMetricCacheToLimit(limit = DASHBOARD_METRIC_CACHE_MAX_ENTRIES) {
    while (this.metricCache.size > limit) {
      const oldestKey = this.metricCache.keys().next().value;
      if (!oldestKey) {
        break;
      }

      this.metricCache.delete(oldestKey);
    }
  }

  private resolveApiHistoryWindowMs(periodMinutes: number): number {
    const normalizedMinutes = Number.isFinite(periodMinutes)
      ? Math.max(5, Math.min(API_HISTORY_MAX_WINDOW_MINUTES, Math.floor(periodMinutes)))
      : 5;
    return normalizedMinutes * 60 * 1000;
  }

  private recordMemoryHistorySample(sample: MemoryHistoryEntry) {
    const normalized = this.normalizeMemoryHistorySample(sample);
    if (!normalized) {
      return;
    }

    this.memoryHistory.push(normalized);
    this.pruneMemoryHistory();
  }

  private getMemoryHistorySeries(windowMs = MEMORY_HISTORY_RETENTION_MS): DashboardHistoryPoint[] {
    const cutoff = Date.now() - windowMs;
    this.pruneMemoryHistory(cutoff);

    return this.memoryHistory
      .filter((entry) => entry.recordedAt >= cutoff)
      .map((entry) => ({
        at: new Date(entry.recordedAt).toISOString(),
        value: entry.usedPercent,
        rssBytes: entry.rssBytes,
        heapUsedBytes: entry.heapUsedBytes,
      }));
  }

  private pruneMemoryHistory(cutoff = Date.now() - MEMORY_HISTORY_RETENTION_MS) {
    while (this.memoryHistory.length > 0 && this.memoryHistory[0].recordedAt < cutoff) {
      this.memoryHistory.shift();
    }

    while (this.memoryHistory.length > MEMORY_HISTORY_MAX_POINTS) {
      this.memoryHistory.shift();
    }
  }

  private normalizeMemoryHistorySample(sample: MemoryHistoryEntry): MemoryHistoryEntry | null {
    const recordedAtRaw = Number(sample.recordedAt);
    const rssBytes = Number(sample.rssBytes);
    const heapUsedBytes = Number(sample.heapUsedBytes);
    const usedPercentRaw =
      sample.usedPercent === null || sample.usedPercent === undefined ? null : Number(sample.usedPercent);

    if (!Number.isFinite(recordedAtRaw) || !Number.isFinite(rssBytes) || !Number.isFinite(heapUsedBytes)) {
      return null;
    }

    if (recordedAtRaw < 0 || rssBytes < 0 || heapUsedBytes < 0) {
      return null;
    }

    const previousTimestamp =
      this.memoryHistory.length > 0 ? this.memoryHistory[this.memoryHistory.length - 1].recordedAt : undefined;

    return {
      recordedAt: this.toMonotonicTimestamp(recordedAtRaw, previousTimestamp),
      usedPercent:
        usedPercentRaw === null
          ? null
          : Number.isFinite(usedPercentRaw)
            ? Math.max(0, Math.min(100, Number(usedPercentRaw.toFixed(2))))
            : null,
      rssBytes: Math.floor(rssBytes),
      heapUsedBytes: Math.floor(heapUsedBytes),
    };
  }

  private toMonotonicTimestamp(timestamp: number, previousTimestamp?: number): number {
    const safeTimestamp = Number.isFinite(timestamp) ? Math.floor(timestamp) : Date.now();
    if (!Number.isFinite(previousTimestamp)) {
      return safeTimestamp;
    }

    return Math.max(safeTimestamp, Number(previousTimestamp) + 1);
  }

  private mapBackupSummary(backup: {
    id: string;
    artifactId: string | null;
    fileName: string | null;
    status: BackupJobStatus;
    sizeBytes: bigint | number | null;
    startedAt: Date | null;
    finishedAt: Date | null;
  }) {
    return {
      id: backup.id,
      artifactId: backup.artifactId || null,
      fileName: backup.fileName || null,
      status: backup.status,
      sizeBytes: backup.sizeBytes ? Number(backup.sizeBytes) : null,
      startedAt: backup.startedAt ? backup.startedAt.toISOString() : null,
      finishedAt: backup.finishedAt ? backup.finishedAt.toISOString() : null,
      durationSeconds: this.calculateDurationSeconds(backup.startedAt, backup.finishedAt),
    };
  }

  private mapJobFailureSummary(failure: {
    id: string;
    type: BackupJobType;
    finishedAt: Date | null;
    error: string | null;
  }) {
    return {
      id: failure.id,
      type: failure.type,
      finishedAt: failure.finishedAt ? failure.finishedAt.toISOString() : null,
      error: this.truncateText(String(failure.error || ''), 220),
    };
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
