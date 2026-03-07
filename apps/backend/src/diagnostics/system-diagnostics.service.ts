import { Injectable, Logger } from '@nestjs/common';
import { BackupJobStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { BackupService } from '../backup/backup.service';
import { CronJobDefinition, CronService } from '../core/cron/cron.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { DashboardActor, SystemDashboardService } from '../dashboard/system-dashboard.service';
import { UpdateService } from '../update/update.service';

type DiagnosticsLevel = 'healthy' | 'attention' | 'critical';
type DiagnosticsSectionError = {
  status: 'error';
  message: string;
};

type DiagnosticsSection<T> = ({ status: 'ok' } & T) | DiagnosticsSectionError;

type DiagnosticsReasonSeverity = Exclude<DiagnosticsLevel, 'healthy'>;

type OperationalSection = {
  version: string | null;
  uptimeHuman: string | null;
  uptimeStartedAt: string | null;
  maintenanceActive: boolean;
  maintenanceReason: string | null;
  maintenanceStartedAt: string | null;
  databaseStatus: string | null;
  redisStatus: string | null;
  apiErrorRateRecent: number | null;
  criticalErrorsRecent: number;
};

type SchedulerProblemType = 'runtime_missing' | 'stuck' | 'stale' | 'failed';

type SchedulerProblem = {
  key: string;
  name: string;
  schedule: string;
  type: SchedulerProblemType;
  summary: string;
  severity: DiagnosticsReasonSeverity;
  nextExpectedRunAt: string | null;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
};

type SchedulerSection = {
  total: number;
  enabled: number;
  ok: number;
  running: number;
  failed: number;
  stale: number;
  stuck: number;
  missingRuntime: number;
  problematic: SchedulerProblem[];
  href: string;
};

type UpdateSummaryItem = {
  id: string;
  version: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  rollbackReason: string | null;
  errorMessage: string | null;
};

type UpdateSection = {
  currentVersion: string | null;
  availableVersion: string | null;
  updateAvailable: boolean;
  lastCheck: string | null;
  inProgress: boolean;
  lastUpdate: UpdateSummaryItem | null;
  lastRollback: UpdateSummaryItem | null;
  href: string | null;
};

type BackupSummaryItem = {
  id: string;
  type: string;
  status: string;
  fileName: string | null;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

type BackupSection = {
  lastBackup: BackupSummaryItem | null;
  lastRestore: BackupSummaryItem | null;
  recentFailure: BackupSummaryItem | null;
  pendingJobs: number;
  runningJobs: number;
  href: string | null;
};

type AlertSectionItem = {
  id: string;
  title: string;
  body: string;
  severity: string;
  createdAt: string;
  source: string | null;
  action: string | null;
};

type AlertsSection = {
  recentCount: number;
  criticalCount: number;
  recent: AlertSectionItem[];
  inboxAvailable: boolean;
  href: string | null;
};

type AuditSectionItem = {
  id: string;
  action: string;
  actionLabel: string;
  message: string | null;
  severity: string | null;
  createdAt: string;
};

type AuditSection = {
  recent: AuditSectionItem[];
  href: string;
};

type LogsSection = {
  exists: boolean;
  pageAvailable: boolean;
  pageKind: 'auditoria-completa' | 'auditoria-sistema';
  coverage: string[];
  limitations: string[];
  summary: string;
  recentTechnicalIssues: Array<{
    id: string;
    origin: string;
    level: 'error' | 'warning';
    title: string;
    occurredAt: string;
    detail: string | null;
  }>;
  href: string;
};

export interface SystemDiagnosticsResponse {
  generatedAt: string;
  role: Role;
  overall: {
    level: DiagnosticsLevel;
    label: string;
    summary: string;
    reasons: string[];
    version: string | null;
    uptimeHuman: string | null;
    maintenanceActive: boolean;
  };
  links: {
    cron: string;
    logs: string;
    audit: string;
    updates: string | null;
    backups: string | null;
    notifications: string | null;
  };
  operational: DiagnosticsSection<OperationalSection>;
  scheduler: DiagnosticsSection<SchedulerSection>;
  update: DiagnosticsSection<UpdateSection>;
  backup: DiagnosticsSection<BackupSection>;
  alerts: DiagnosticsSection<AlertsSection>;
  audit: DiagnosticsSection<AuditSection>;
  logs: DiagnosticsSection<LogsSection>;
}

const DIAGNOSTICS_WINDOW_MINUTES = 60;
const DIAGNOSTICS_AUDIT_PREFIXES = [
  'UPDATE_',
  'MAINTENANCE_',
  'BACKUP_',
  'RESTORE_',
  'OPS_',
  'JOB_',
] as const;
const STALE_GRACE_MS = 5 * 60 * 1000;
const STUCK_GRACE_MS = 30 * 60 * 1000;

@Injectable()
export class SystemDiagnosticsService {
  private readonly logger = new Logger(SystemDiagnosticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemDashboardService: SystemDashboardService,
    private readonly cronService: CronService,
    private readonly updateService: UpdateService,
    private readonly backupService: BackupService,
    private readonly auditService: AuditService,
  ) {}

  async getDiagnostics(actor: DashboardActor): Promise<SystemDiagnosticsResponse> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - DIAGNOSTICS_WINDOW_MINUTES * 60 * 1000);

    const [operational, scheduler, update, backup, alerts, audit] = await Promise.all([
      this.safeSection('operational', async () => this.getOperationalSection(actor)),
      this.safeSection('scheduler', async () => this.getSchedulerSection(now)),
      this.safeSection('update', async () => this.getUpdateSection(actor)),
      this.safeSection('backup', async () => this.getBackupSection(actor)),
      this.safeSection('alerts', async () => this.getAlertsSection(actor, windowStart)),
      this.safeSection('audit', async () => this.getAuditSection()),
    ]);

    const logs = this.buildLogsSection(actor, update, backup);
    const overall = this.buildOverall(operational, scheduler, update, backup, alerts, logs);

    return {
      generatedAt: now.toISOString(),
      role: actor.role,
      overall,
      links: {
        cron: '/configuracoes/sistema/cron',
        logs: '/logs',
        audit: '/logs',
        updates: actor.role === Role.SUPER_ADMIN ? '/configuracoes/sistema/updates?tab=status' : null,
        backups: actor.role === Role.SUPER_ADMIN ? '/configuracoes/sistema/updates?tab=backup' : null,
        notifications: actor.role === Role.SUPER_ADMIN ? '/notifications' : null,
      },
      operational,
      scheduler,
      update,
      backup,
      alerts,
      audit,
      logs,
    };
  }

  private async getOperationalSection(actor: DashboardActor): Promise<OperationalSection> {
    const dashboard = await this.systemDashboardService.getDashboard(actor, {
      periodMinutes: DIAGNOSTICS_WINDOW_MINUTES,
    });

    return {
      version: this.normalizeString(dashboard?.version?.version),
      uptimeHuman: this.normalizeString(dashboard?.uptime?.human),
      uptimeStartedAt: this.normalizeString(dashboard?.uptime?.startedAt),
      maintenanceActive: Boolean(dashboard?.maintenance?.enabled),
      maintenanceReason: this.normalizeString(dashboard?.maintenance?.reason),
      maintenanceStartedAt: this.normalizeString(dashboard?.maintenance?.startedAt),
      databaseStatus: this.normalizeString(dashboard?.database?.status),
      redisStatus: this.normalizeString(dashboard?.redis?.status),
      apiErrorRateRecent: this.toNumberOrNull(dashboard?.routeErrors?.errorRateRecent),
      criticalErrorsRecent: Array.isArray(dashboard?.errors?.recent) ? dashboard.errors.recent.length : 0,
    };
  }

  private async getSchedulerSection(now: Date): Promise<SchedulerSection> {
    const jobs = await this.cronService.getRuntimeJobs();
    const nowMs = now.getTime();
    const problematic = jobs
      .map((job) => this.resolveSchedulerProblem(job, nowMs))
      .filter((item): item is SchedulerProblem => item !== null)
      .sort((left, right) => this.compareProblemSeverity(left, right))
      .slice(0, 6);

    const enabledJobs = jobs.filter((job) => job.enabled);
    const running = jobs.filter((job) => job.lastStatus === 'running').length;
    const failed = jobs.filter((job) => this.isJobFailing(job)).length;
    const stale = jobs.filter((job) => this.isJobStale(job, nowMs)).length;
    const stuck = jobs.filter((job) => this.isJobStuck(job, nowMs)).length;
    const missingRuntime = jobs.filter((job) => job.runtimeRegistered === false || job.issue === 'runtime_not_registered').length;

    return {
      total: jobs.length,
      enabled: enabledJobs.length,
      ok: Math.max(0, jobs.length - new Set(problematic.map((item) => item.key)).size),
      running,
      failed,
      stale,
      stuck,
      missingRuntime,
      problematic,
      href: '/configuracoes/sistema/cron',
    };
  }

  private async getUpdateSection(actor: DashboardActor): Promise<UpdateSection> {
    const [status, logs] = await Promise.all([
      this.updateService.getUpdateStatus(),
      this.updateService.getUpdateLogs(8),
    ]);

    const lastUpdate = logs[0] ? this.mapUpdateLog(logs[0]) : null;
    const lastRollback = logs.find((item) => this.normalizeString(item.rollbackReason)) || null;

    return {
      currentVersion: this.normalizeString(status.currentVersion),
      availableVersion: this.normalizeString(status.availableVersion),
      updateAvailable: Boolean(status.updateAvailable),
      lastCheck: status.lastCheck ? new Date(status.lastCheck).toISOString() : null,
      inProgress: logs.some((item) => String(item.status || '').toUpperCase() === 'STARTED' && !item.completedAt),
      lastUpdate,
      lastRollback: lastRollback ? this.mapUpdateLog(lastRollback) : null,
      href: actor.role === Role.SUPER_ADMIN ? '/configuracoes/sistema/updates?tab=status' : null,
    };
  }

  private async getBackupSection(actor: DashboardActor): Promise<BackupSection> {
    const data = await this.backupService.listBackupsAndJobs(20);
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const lastBackup = jobs.find((job) => String(job.type || '').toUpperCase().includes('BACKUP')) || null;
    const lastRestore = jobs.find((job) => String(job.type || '').toUpperCase().includes('RESTORE')) || null;
    const recentFailure = jobs.find((job) => String(job.status || '').toUpperCase() === BackupJobStatus.FAILED) || null;

    return {
      lastBackup: lastBackup ? this.mapBackupJob(lastBackup) : null,
      lastRestore: lastRestore ? this.mapBackupJob(lastRestore) : null,
      recentFailure: recentFailure ? this.mapBackupJob(recentFailure) : null,
      pendingJobs: jobs.filter((job) => String(job.status || '').toUpperCase() === BackupJobStatus.PENDING).length,
      runningJobs: jobs.filter((job) => String(job.status || '').toUpperCase() === BackupJobStatus.RUNNING).length,
      href: actor.role === Role.SUPER_ADMIN ? '/configuracoes/sistema/updates?tab=backup' : null,
    };
  }

  private async getAlertsSection(actor: DashboardActor, windowStart: Date): Promise<AlertsSection> {
    const where: Record<string, unknown> = {
      module: 'operational-alerts',
      createdAt: {
        gte: windowStart,
      },
    };

    const [recentCount, criticalCount, recentRows] = await Promise.all([
      this.prisma.notification.count({ where: where as any }),
      this.prisma.notification.count({
        where: {
          ...(where as any),
          severity: 'critical',
        },
      }),
      this.prisma.notification.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          body: true,
          severity: true,
          source: true,
          createdAt: true,
          data: true,
        },
      }),
    ]);

    return {
      recentCount,
      criticalCount,
      recent: recentRows.map((row) => ({
        id: row.id,
        title: row.title,
        body: this.truncateText(row.body, 180),
        severity: row.severity,
        createdAt: row.createdAt.toISOString(),
        source: this.normalizeString(row.source),
        action: this.normalizeString((row.data as Record<string, unknown> | null)?.alertAction),
      })),
      inboxAvailable: actor.role === Role.SUPER_ADMIN,
      href: actor.role === Role.SUPER_ADMIN ? '/notifications' : null,
    };
  }

  private async getAuditSection(): Promise<AuditSection> {
    const recent = await this.auditService.findAll({
      page: 1,
      limit: 5,
      severity: 'critical',
      allowedActionPrefixes: [...DIAGNOSTICS_AUDIT_PREFIXES],
    });

    return {
      recent: Array.isArray(recent?.data)
        ? recent.data.map((item: Record<string, unknown>) => ({
            id: this.normalizeString(item.id) || '',
            action: this.normalizeString(item.action) || 'UNKNOWN',
            actionLabel: this.normalizeString(item.actionLabel) || this.normalizeString(item.action) || 'Evento',
            message: this.normalizeString(item.message),
            severity: this.normalizeString(item.severity),
            createdAt: this.normalizeString(item.createdAt) || new Date().toISOString(),
          }))
        : [],
      href: '/logs',
    };
  }

  private buildLogsSection(
    actor: DashboardActor,
    update: DiagnosticsSection<UpdateSection>,
    backup: DiagnosticsSection<BackupSection>,
  ): DiagnosticsSection<LogsSection> {
    const recentTechnicalIssues: LogsSection['recentTechnicalIssues'] = [];

    if (update.status === 'ok' && update.lastUpdate && update.lastUpdate.status === 'FAILED') {
      recentTechnicalIssues.push({
        id: `update:${update.lastUpdate.id}`,
        origin: 'updates',
        level: 'error',
        title: 'Atualizacao falhou',
        occurredAt: update.lastUpdate.completedAt || update.lastUpdate.startedAt || new Date().toISOString(),
        detail: this.truncateText(update.lastUpdate.errorMessage, 160),
      });
    }

    if (backup.status === 'ok' && backup.recentFailure) {
      recentTechnicalIssues.push({
        id: `backup:${backup.recentFailure.id}`,
        origin: 'backup-restore',
        level: String(backup.recentFailure.type || '').toUpperCase().includes('RESTORE') ? 'error' : 'warning',
        title: String(backup.recentFailure.type || '').toUpperCase().includes('RESTORE')
          ? 'Restore com falha'
          : 'Backup com falha',
        occurredAt: backup.recentFailure.finishedAt || backup.recentFailure.startedAt || backup.recentFailure.createdAt || new Date().toISOString(),
        detail: this.truncateText(backup.recentFailure.error, 160),
      });
    }

    recentTechnicalIssues.sort((left, right) => {
      return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
    });

    return {
      status: 'ok',
      exists: true,
      pageAvailable: true,
      pageKind: actor.role === Role.SUPER_ADMIN ? 'auditoria-completa' : 'auditoria-sistema',
      coverage: [
        'Auditoria do sistema',
        'Historico de atualizacoes',
        'Historico de backup e restore',
      ],
      limitations: [
        'Nao existe persistencia generica unica para logs tecnicos de runtime.',
        'Erros tecnicos detalhados continuam distribuidos por dominio.',
      ],
      summary: actor.role === Role.SUPER_ADMIN
        ? 'A pagina /logs foi reaproveitada como base de auditoria e complementa o diagnostico com eventos de update e backup.'
        : 'A pagina /logs reaproveita a auditoria do sistema. Logs tecnicos genericos ainda aparecem apenas por dominio.',
      recentTechnicalIssues: recentTechnicalIssues.slice(0, 5),
      href: '/logs',
    };
  }

  private buildOverall(
    operational: DiagnosticsSection<OperationalSection>,
    scheduler: DiagnosticsSection<SchedulerSection>,
    update: DiagnosticsSection<UpdateSection>,
    backup: DiagnosticsSection<BackupSection>,
    alerts: DiagnosticsSection<AlertsSection>,
    logs: DiagnosticsSection<LogsSection>,
  ) {
    let level: DiagnosticsLevel = 'healthy';
    const reasons: string[] = [];

    const pushReason = (severity: DiagnosticsReasonSeverity, reason: string) => {
      reasons.push(reason);
      level = this.escalateLevel(level, severity);
    };

    if (operational.status === 'error') {
      pushReason('attention', 'Leitura operacional parcial neste momento.');
    } else {
      if (operational.maintenanceActive) {
        pushReason('attention', 'Modo manutencao ativo.');
      }
      if (this.isCriticalInfraStatus(operational.databaseStatus) || this.isCriticalInfraStatus(operational.redisStatus)) {
        pushReason('critical', 'Infraestrutura principal com degradacao recente.');
      }
      if ((operational.apiErrorRateRecent || 0) >= 10) {
        pushReason('critical', 'Taxa de erro da API acima do esperado.');
      }
      if (operational.criticalErrorsRecent > 0) {
        pushReason('attention', 'Existem eventos criticos recentes na auditoria.');
      }
    }

    if (scheduler.status === 'error') {
      pushReason('attention', 'Runtime das tarefas indisponivel para consulta.');
    } else {
      if (scheduler.missingRuntime > 0 || scheduler.stuck > 0) {
        pushReason('critical', 'Existem tarefas criticas sem runtime ou travadas.');
      } else if (scheduler.stale > 0 || scheduler.failed > 0) {
        pushReason('attention', 'Existem tarefas agendadas com falha ou atraso.');
      }
    }

    if (update.status === 'error') {
      pushReason('attention', 'Nao foi possivel carregar o estado de update.');
    } else {
      if (update.lastUpdate?.status === 'FAILED') {
        pushReason('critical', 'A ultima atualizacao falhou.');
      } else if (update.inProgress) {
        pushReason('attention', 'Existe atualizacao em andamento.');
      }
    }

    if (backup.status === 'error') {
      pushReason('attention', 'Nao foi possivel carregar o estado de backup e restore.');
    } else if (backup.recentFailure) {
      const isRestore = String(backup.recentFailure.type || '').toUpperCase().includes('RESTORE');
      pushReason(isRestore ? 'critical' : 'attention', isRestore ? 'Houve falha recente em restore.' : 'Houve falha recente em backup.');
    }

    if (alerts.status === 'error') {
      pushReason('attention', 'Nao foi possivel carregar os alertas operacionais.');
    } else if (alerts.criticalCount > 0) {
      pushReason('critical', 'Alertas operacionais criticos recentes foram emitidos.');
    } else if (alerts.recentCount > 0) {
      pushReason('attention', 'Existem alertas operacionais recentes para revisao.');
    }

    if (logs.status === 'error') {
      pushReason('attention', 'Visao de logs parcialmente indisponivel.');
    }

    const summary =
      reasons.length === 0
        ? 'Sem sinais criticos nas leituras mais recentes.'
        : reasons[0];

    return {
      level,
      label: this.getLevelLabel(level),
      summary,
      reasons: reasons.slice(0, 5),
      version: operational.status === 'ok' ? operational.version : null,
      uptimeHuman: operational.status === 'ok' ? operational.uptimeHuman : null,
      maintenanceActive: operational.status === 'ok' ? operational.maintenanceActive : false,
    };
  }

  private async safeSection<T>(
    name: string,
    loader: () => Promise<T>,
  ): Promise<DiagnosticsSection<T>> {
    try {
      const value = await loader();
      return {
        status: 'ok',
        ...value,
      };
    } catch (error) {
      this.logger.warn(`Falha ao montar bloco de diagnostico ${name}: ${String(error)}`);
      return {
        status: 'error',
        message: 'Indisponivel no momento.',
      };
    }
  }

  private resolveSchedulerProblem(job: CronJobDefinition, nowMs: number): SchedulerProblem | null {
    if (job.runtimeRegistered === false || job.issue === 'runtime_not_registered') {
      return {
        key: job.key,
        name: job.name,
        schedule: job.schedule,
        type: 'runtime_missing',
        summary: 'Configurada, mas nao registrada no runtime.',
        severity: 'critical',
        nextExpectedRunAt: this.toIsoOrNull(job.nextExpectedRunAt),
        lastSucceededAt: this.toIsoOrNull(job.lastSucceededAt),
        lastFailedAt: this.toIsoOrNull(job.lastFailedAt),
      };
    }

    if (this.isJobStuck(job, nowMs)) {
      return {
        key: job.key,
        name: job.name,
        schedule: job.schedule,
        type: 'stuck',
        summary: 'Permanece em execucao por tempo acima do esperado.',
        severity: 'critical',
        nextExpectedRunAt: this.toIsoOrNull(job.nextExpectedRunAt),
        lastSucceededAt: this.toIsoOrNull(job.lastSucceededAt),
        lastFailedAt: this.toIsoOrNull(job.lastFailedAt),
      };
    }

    if (this.isJobStale(job, nowMs)) {
      return {
        key: job.key,
        name: job.name,
        schedule: job.schedule,
        type: 'stale',
        summary: 'Nao executou dentro da janela esperada.',
        severity: 'attention',
        nextExpectedRunAt: this.toIsoOrNull(job.nextExpectedRunAt),
        lastSucceededAt: this.toIsoOrNull(job.lastSucceededAt),
        lastFailedAt: this.toIsoOrNull(job.lastFailedAt),
      };
    }

    if (this.isJobFailing(job)) {
      return {
        key: job.key,
        name: job.name,
        schedule: job.schedule,
        type: 'failed',
        summary: 'Ultimas execucoes terminaram com falha.',
        severity: 'attention',
        nextExpectedRunAt: this.toIsoOrNull(job.nextExpectedRunAt),
        lastSucceededAt: this.toIsoOrNull(job.lastSucceededAt),
        lastFailedAt: this.toIsoOrNull(job.lastFailedAt),
      };
    }

    return null;
  }

  private isJobStale(job: CronJobDefinition, nowMs: number): boolean {
    if (!job.enabled || !job.nextExpectedRunAt) {
      return false;
    }

    return nowMs - job.nextExpectedRunAt.getTime() > (job.watchdogStaleAfterMs || STALE_GRACE_MS);
  }

  private isJobStuck(job: CronJobDefinition, nowMs: number): boolean {
    if (job.lastStatus !== 'running' || !job.lastStartedAt) {
      return false;
    }

    return nowMs - job.lastStartedAt.getTime() > (job.watchdogStuckAfterMs || STUCK_GRACE_MS);
  }

  private isJobFailing(job: CronJobDefinition): boolean {
    if (job.lastStatus !== 'failed' || !job.lastFailedAt) {
      return false;
    }

    if (job.lastSucceededAt && job.lastSucceededAt >= job.lastFailedAt) {
      return false;
    }

    return true;
  }

  private mapUpdateLog(item: Record<string, unknown>): UpdateSummaryItem {
    return {
      id: this.normalizeString(item.id) || '',
      version: this.normalizeString(item.version),
      status: this.normalizeString(item.status) || 'UNKNOWN',
      startedAt: this.normalizeDateString(item.startedAt),
      completedAt: this.normalizeDateString(item.completedAt),
      durationSeconds: this.toNumberOrNull(item.duration),
      rollbackReason: this.normalizeString(item.rollbackReason),
      errorMessage: this.truncateText(item.errorMessage, 180),
    };
  }

  private mapBackupJob(item: Record<string, unknown>): BackupSummaryItem {
    return {
      id: this.normalizeString(item.id) || '',
      type: this.normalizeString(item.type) || 'UNKNOWN',
      status: this.normalizeString(item.status) || 'UNKNOWN',
      fileName: this.normalizeString(item.fileName),
      createdAt: this.normalizeDateString(item.createdAt),
      startedAt: this.normalizeDateString(item.startedAt),
      finishedAt: this.normalizeDateString(item.finishedAt),
      error: this.truncateText(item.error, 180),
    };
  }

  private compareProblemSeverity(left: SchedulerProblem, right: SchedulerProblem): number {
    const weight = (value: DiagnosticsReasonSeverity) => (value === 'critical' ? 2 : 1);
    if (weight(left.severity) !== weight(right.severity)) {
      return weight(right.severity) - weight(left.severity);
    }

    const leftTime = left.lastFailedAt || left.nextExpectedRunAt || left.lastSucceededAt || '';
    const rightTime = right.lastFailedAt || right.nextExpectedRunAt || right.lastSucceededAt || '';
    return new Date(rightTime || 0).getTime() - new Date(leftTime || 0).getTime();
  }

  private isCriticalInfraStatus(status: string | null): boolean {
    return ['degraded', 'error', 'down'].includes(String(status || '').trim().toLowerCase());
  }

  private getLevelLabel(level: DiagnosticsLevel): string {
    if (level === 'critical') {
      return 'Critico';
    }
    if (level === 'attention') {
      return 'Atencao';
    }
    return 'Saudavel';
  }

  private escalateLevel(current: DiagnosticsLevel, next: DiagnosticsReasonSeverity): DiagnosticsLevel {
    const weight = {
      healthy: 0,
      attention: 1,
      critical: 2,
    } as const;

    return weight[next] > weight[current] ? next : current;
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private normalizeDateString(value: unknown): string | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private toIsoOrNull(value?: Date | null): string | null {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString();
  }

  private toNumberOrNull(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private truncateText(value: unknown, maxLength: number): string | null {
    const normalized = this.normalizeString(value);
    if (!normalized) {
      return null;
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
  }
}
