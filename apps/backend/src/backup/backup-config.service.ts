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
  private readonly databaseUrl: string;
  private readonly databaseConfig: BackupDatabaseConfig;
  private readonly activeDbStateFile: string;

  constructor(private readonly configService: ConfigService) {
    this.projectRoot = this.resolveProjectRoot();
    this.backupDir = this.resolveBackupDir();
    this.executionMode = this.resolveExecutionMode();
    this.databaseUrl = this.readDatabaseUrl();
    this.databaseConfig = this.parseDatabaseUrl(this.databaseUrl);
    this.ensureBackupDir();
    this.activeDbStateFile = this.resolveActiveDatabaseStateFile();
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

  getLockBackoffBaseMs(): number {
    return this.readPositiveInt('BACKUP_LOCK_BACKOFF_BASE_MS', 1000);
  }

  getLockBackoffMaxMs(): number {
    return this.readPositiveInt('BACKUP_LOCK_BACKOFF_MAX_MS', 30000);
  }

  getLockMaxAttempts(): number {
    return this.readPositiveInt('BACKUP_LOCK_MAX_ATTEMPTS', 30);
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

  getDatabaseConfig(options?: { useActiveDatabase?: boolean }): BackupDatabaseConfig {
    const database = options?.useActiveDatabase ? this.getActiveDatabaseName() : this.databaseConfig.database;
    return {
      ...this.databaseConfig,
      database,
    };
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

  getRequiredTablesForRestoreValidation(): string[] {
    const raw = (this.configService.get<string>('BACKUP_RESTORE_REQUIRED_TABLES') || '').trim();
    if (!raw) {
      return ['_prisma_migrations'];
    }

    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  isDangerousObjectInspectionEnabled(): boolean {
    return this.readBoolean('BACKUP_RESTORE_BLOCK_DANGEROUS_OBJECTS', true);
  }

  getActiveDatabaseStateFile(): string {
    return this.activeDbStateFile;
  }

  getActiveDatabaseName(): string {
    const envOverride = (this.configService.get<string>('BACKUP_ACTIVE_DATABASE_NAME') || '').trim();
    if (envOverride) {
      return this.normalizeDatabaseIdentifier(envOverride, 'BACKUP_ACTIVE_DATABASE_NAME');
    }

    const fromFile = this.readActiveDatabaseNameFromFile();
    if (fromFile) {
      return fromFile;
    }

    return this.databaseConfig.database;
  }

  setActiveDatabaseName(databaseName: string): void {
    const normalized = this.normalizeDatabaseIdentifier(databaseName, 'activeDatabaseName');
    const payload = {
      activeDatabaseName: normalized,
      updatedAt: new Date().toISOString(),
    };

    const parentDir = path.dirname(this.activeDbStateFile);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(this.activeDbStateFile, JSON.stringify(payload, null, 2), {
      encoding: 'utf8',
      flag: 'w',
      mode: 0o600,
    });
  }

  clearActiveDatabaseName(): void {
    if (fs.existsSync(this.activeDbStateFile)) {
      fs.unlinkSync(this.activeDbStateFile);
    }
  }

  buildDatabaseUrl(databaseName?: string): string {
    const targetDatabase = this.normalizeDatabaseIdentifier(
      databaseName || this.getActiveDatabaseName(),
      'databaseName',
    );

    const parsed = new URL(this.databaseUrl);
    parsed.pathname = `/${targetDatabase}`;
    return parsed.toString();
  }

  buildRollbackDatabaseName(activeDatabaseName: string, jobId: string): string {
    const base = this.normalizeDatabaseIdentifier(activeDatabaseName, 'activeDatabaseName').toLowerCase();
    const safeJobId = jobId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8) || 'job';
    const ts = Date.now().toString(36);
    let candidate = `${base}_rollback_${ts}_${safeJobId}`.toLowerCase();
    if (candidate.length > 63) {
      candidate = candidate.slice(0, 63);
    }
    if (!this.isValidDatabaseIdentifier(candidate)) {
      throw new Error('Falha ao montar nome de database para rollback');
    }
    return candidate;
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

  private readDatabaseUrl(): string {
    const databaseUrl = (this.configService.get<string>('DATABASE_URL') || '').trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL nao configurada para o subsistema de backup/restore');
    }
    return databaseUrl;
  }

  private parseDatabaseUrl(databaseUrl: string): BackupDatabaseConfig {
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

  private resolveActiveDatabaseStateFile(): string {
    const configured = (this.configService.get<string>('BACKUP_ACTIVE_DB_STATE_FILE') || '').trim();
    if (!configured) {
      return path.join(this.backupDir, 'active-db-state.json');
    }

    if (path.isAbsolute(configured)) {
      return configured;
    }

    return path.resolve(this.projectRoot, configured);
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

  private readActiveDatabaseNameFromFile(): string | null {
    if (!fs.existsSync(this.activeDbStateFile)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.activeDbStateFile, 'utf8');
      const parsed = JSON.parse(raw) as { activeDatabaseName?: unknown };
      if (typeof parsed.activeDatabaseName !== 'string' || !parsed.activeDatabaseName.trim()) {
        return null;
      }
      return this.normalizeDatabaseIdentifier(parsed.activeDatabaseName, 'activeDatabaseName');
    } catch (error) {
      this.logger.warn(`Falha ao ler estado do activeDatabaseName: ${String(error)}`);
      return null;
    }
  }

  private normalizeDatabaseIdentifier(value: string, fieldName: string): string {
    const normalized = value.trim();
    if (!this.isValidDatabaseIdentifier(normalized)) {
      throw new Error(`${fieldName} invalido para identificador de database PostgreSQL`);
    }
    return normalized;
  }

  private isValidDatabaseIdentifier(value: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(value);
  }
}
