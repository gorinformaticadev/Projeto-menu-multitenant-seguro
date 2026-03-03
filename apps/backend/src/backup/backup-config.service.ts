import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface BackupDatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sslMode?: string;
}

@Injectable()
export class BackupConfigService {
  private readonly logger = new Logger(BackupConfigService.name);
  private readonly projectRoot: string;
  private readonly backupDir: string;
  private readonly executionMode: 'docker' | 'native';
  private readonly databaseConfig: BackupDatabaseConfig;

  constructor(private readonly configService: ConfigService) {
    this.projectRoot = this.resolveProjectRoot();
    this.backupDir = this.resolveBackupDir();
    this.executionMode = this.resolveExecutionMode();
    this.databaseConfig = this.parseDatabaseUrl();
    this.ensureBackupDir();
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getBackendDir(): string {
    return path.join(this.projectRoot, 'apps', 'backend');
  }

  getExecutionMode(): 'docker' | 'native' {
    return this.executionMode;
  }

  getBackupDir(): string {
    return this.backupDir;
  }

  getMaxUploadBytes(): number {
    return this.readPositiveInt('BACKUP_MAX_SIZE', 2 * 1024 * 1024 * 1024);
  }

  getJobTimeoutMs(): number {
    return this.readPositiveInt('BACKUP_JOB_TIMEOUT_SECONDS', 3600) * 1000;
  }

  getLeaseSeconds(): number {
    return this.readPositiveInt('BACKUP_LEASE_SECONDS', 7200);
  }

  getRetentionCount(): number {
    return this.readPositiveInt('BACKUP_RETENTION_COUNT', 30);
  }

  getQueuePollMs(): number {
    return this.readPositiveInt('BACKUP_QUEUE_POLL_MS', 2000);
  }

  getAllowedExtensions(): string[] {
    return ['.dump', '.backup'];
  }

  getProtectedTablesForRestore(): string[] {
    const raw = (this.configService.get<string>('BACKUP_RESTORE_PROTECTED_TABLES') || '').trim();
    if (!raw) {
      return [
        'backup_jobs',
        'backup_artifacts',
        'backup_leases',
        'backup_logs',
        'backup_restore_logs',
      ];
    }

    return raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);
  }

  getDatabaseConfig(): BackupDatabaseConfig {
    return this.databaseConfig;
  }

  getEnvironmentScope(): string {
    const explicitScope = (this.configService.get<string>('BACKUP_ENV_SCOPE') || '').trim();
    if (explicitScope) {
      return explicitScope;
    }

    const db = this.databaseConfig;
    return `${db.host}:${db.port}/${db.database}`;
  }

  getRestoreMaintenanceWindowSeconds(): number {
    return this.readPositiveInt('BACKUP_RESTORE_MAINTENANCE_WINDOW_SECONDS', 1800);
  }

  isStrictUploadRestoreInspectionEnabled(): boolean {
    return this.readBoolean('BACKUP_RESTORE_STRICT_UPLOAD_INSPECTION', true);
  }

  getUploadRestoreBlockedObjectTypes(): string[] {
    const fallback = [
      'FUNCTION',
      'PROCEDURE',
      'AGGREGATE',
      'EVENT TRIGGER',
      'EXTENSION',
      'LANGUAGE',
      'FOREIGN DATA WRAPPER',
      'SERVER',
      'USER MAPPING',
      'PUBLICATION',
      'SUBSCRIPTION',
    ];

    const raw = (this.configService.get<string>('BACKUP_RESTORE_BLOCKED_OBJECT_TYPES') || '').trim();
    if (!raw) {
      return fallback;
    }

    const parsed = raw
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value.length > 0);

    return parsed.length > 0 ? parsed : fallback;
  }

  getRestoreReconnectAttempts(): number {
    return this.readPositiveInt('BACKUP_RESTORE_RECONNECT_ATTEMPTS', 6);
  }

  getRestoreReconnectDelayMs(): number {
    return this.readPositiveInt('BACKUP_RESTORE_RECONNECT_DELAY_MS', 2000);
  }

  buildStagingDatabaseName(jobId: string): string {
    const safeJobId = jobId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 16) || 'job';
    const prefix =
      (this.configService.get<string>('BACKUP_STAGING_DB_PREFIX') || 'restore_stage').replace(
        /[^a-zA-Z0-9_]/g,
        '',
      ) || 'restore_stage';
    return `${prefix}_${safeJobId}`.toLowerCase();
  }

  getBinary(command:
    | 'pg_dump'
    | 'pg_restore'
    | 'psql'
    | 'createdb'
    | 'dropdb'
    | 'pnpm',
  ): string {
    const envMap: Record<string, string> = {
      pg_dump: 'PG_DUMP_BIN',
      pg_restore: 'PG_RESTORE_BIN',
      psql: 'PSQL_BIN',
      createdb: 'PG_CREATEDB_BIN',
      dropdb: 'PG_DROPDB_BIN',
      pnpm: 'PNPM_BIN',
    };
    const envName = envMap[command];
    const candidate = (this.configService.get<string>(envName) || '').trim();
    return candidate || command;
  }

  private resolveProjectRoot(): string {
    const candidates = [
      process.cwd(),
      path.resolve(process.cwd(), '..'),
      path.resolve(process.cwd(), '..', '..'),
      path.resolve(__dirname, '..', '..', '..'),
      path.resolve(__dirname, '..', '..', '..', '..'),
      path.resolve(__dirname, '..', '..', '..', '..', '..'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'apps', 'backend'))) {
        return candidate;
      }
    }

    return process.cwd();
  }

  private resolveBackupDir(): string {
    const configured = (this.configService.get<string>('BACKUP_DIR') || '').trim();
    if (configured) {
      return path.resolve(configured);
    }

    const dockerDefault = '/app/apps/backend/backups';
    if (fs.existsSync(dockerDefault)) {
      return dockerDefault;
    }

    const projectDefault = path.join(this.projectRoot, 'apps', 'backend', 'backups');
    if (fs.existsSync(path.dirname(projectDefault))) {
      return projectDefault;
    }

    return path.resolve(process.cwd(), 'backups');
  }

  private resolveExecutionMode(): 'docker' | 'native' {
    const forced = (this.configService.get<string>('BACKUP_EXECUTION_MODE') || '').toLowerCase();
    if (forced === 'docker' || forced === 'native') {
      return forced;
    }

    if (this.configService.get<string>('IS_DOCKER') === 'true') {
      return 'docker';
    }

    try {
      if (fs.existsSync('/.dockerenv')) {
        return 'docker';
      }
      const cgroup = '/proc/1/cgroup';
      if (fs.existsSync(cgroup)) {
        const content = fs.readFileSync(cgroup, 'utf8');
        if (/docker|containerd|kubepods/i.test(content)) {
          return 'docker';
        }
      }
    } catch (error) {
      this.logger.warn(`Falha ao detectar ambiente automaticamente: ${String(error)}`);
    }

    return 'native';
  }

  private parseDatabaseUrl(): BackupDatabaseConfig {
    const databaseUrl = (this.configService.get<string>('DATABASE_URL') || '').trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL nao configurada para o subsistema de backup/restore');
    }

    let parsed: URL;
    try {
      parsed = new URL(databaseUrl);
    } catch {
      throw new Error('DATABASE_URL invalida para backup/restore');
    }

    const database = parsed.pathname.replace(/^\//, '').trim();
    if (!database) {
      throw new Error('DATABASE_URL sem nome de database');
    }

    return {
      host: parsed.hostname,
      port: Number(parsed.port || '5432'),
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      database,
      sslMode: parsed.searchParams.get('sslmode') || undefined,
    };
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    fs.accessSync(this.backupDir, fs.constants.W_OK);
  }

  private readPositiveInt(envName: string, fallback: number): number {
    const raw = (this.configService.get<string>(envName) || '').trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value <= 0) {
      return fallback;
    }
    return Math.floor(value);
  }

  private readBoolean(envName: string, fallback: boolean): boolean {
    const raw = (this.configService.get<string>(envName) || '').trim().toLowerCase();
    if (!raw) {
      return fallback;
    }
    if (['1', 'true', 'yes', 'on'].includes(raw)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(raw)) {
      return false;
    }
    return fallback;
  }
}
