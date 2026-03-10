import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface CanonicalPaths {
  projectRoot: string;
  uploadsDir: string;
  tenantsDir: string;
  logosDir: string;
  tempDir: string;
  secureDir: string;
  backupsDir: string;
}

const SAFE_STORAGE_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;

export function ensureDirectory(dirPath: string): string {
  const target = path.resolve(dirPath);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

function isDockerEnvironment(): boolean {
  if (process.env.IS_DOCKER === 'true') {
    return true;
  }

  try {
    if (fs.existsSync('/.dockerenv')) {
      return true;
    }

    const cgroupPath = '/proc/1/cgroup';
    if (fs.existsSync(cgroupPath)) {
      const cgroupContent = fs.readFileSync(cgroupPath, 'utf8');
      return /docker|containerd|kubepods/i.test(cgroupContent);
    }
  } catch {
    // noop
  }

  return false;
}

function resolveProjectRootFromDir(baseDir: string): string {
  let cursor = baseDir;

  while (true) {
    const backendPath = path.join(cursor, 'apps', 'backend');
    if (fs.existsSync(backendPath)) {
      return cursor;
    }

    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  const fromEnv = (process.env.PROJECT_ROOT || '').trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  // Fallback deterministico sem depender de process.cwd().
  return path.resolve(baseDir, '../../../../../../');
}

function normalizeForPathComparison(value: string): string {
  return value.replace(/\\/g, '/').trim().replace(/\/+$/, '').toLowerCase();
}

function isLegacyRootLogosDir(value: string): boolean {
  const normalized = normalizeForPathComparison(value);
  return normalized === '/logos';
}

export function resolveCanonicalPaths(options?: {
  projectRoot?: string;
  uploadsDir?: string;
  backupsDir?: string;
  logosDir?: string;
}): CanonicalPaths {
  const projectRoot = path.resolve(
    options?.projectRoot || resolveProjectRootFromDir(__dirname),
  );
  const docker = isDockerEnvironment();

  const rawUploads =
    options?.uploadsDir ||
    (process.env.UPLOADS_DIR || '').trim() ||
    (docker ? '/app/uploads' : path.join(projectRoot, 'uploads'));

  const rawBackups =
    options?.backupsDir ||
    (process.env.BACKUP_DIR || '').trim() ||
    (docker ? '/app/backups' : path.join(projectRoot, 'backups'));

  const configuredLogosDir =
    options?.logosDir ||
    (process.env.LOGOS_UPLOAD_DIR || '').trim();

  const rawLogos =
    configuredLogosDir && isLegacyRootLogosDir(configuredLogosDir)
      ? path.join(rawUploads, 'logos')
      : configuredLogosDir || path.join(rawUploads, 'logos');

  const uploadsDir = path.resolve(rawUploads);
  const tenantsDir = path.resolve(path.join(uploadsDir, 'tenants'));
  const backupsDir = path.resolve(rawBackups);
  const logosDir = path.resolve(rawLogos);
  const tempDir = path.resolve(path.join(uploadsDir, 'temp'));
  const secureDir = path.resolve(path.join(uploadsDir, 'secure'));

  return {
    projectRoot,
    uploadsDir,
    tenantsDir,
    logosDir,
    tempDir,
    secureDir,
    backupsDir,
  };
}

export function resolveLogosDirPath(): string {
  return ensureDirectory(resolveCanonicalPaths().logosDir);
}

export function resolveUploadsDirPath(): string {
  return ensureDirectory(resolveCanonicalPaths().uploadsDir);
}

export function resolveTenantsDirPath(): string {
  return ensureDirectory(resolveCanonicalPaths().tenantsDir);
}

export function resolveTenantUploadsRootPath(tenantId: string): string {
  return ensureDirectory(path.join(resolveTenantsDirPath(), sanitizeStorageSegment(tenantId, 'tenant')));
}

export function resolveTenantLogosDirPath(tenantId: string): string {
  return ensureDirectory(path.join(resolveTenantUploadsRootPath(tenantId), 'logos'));
}

export function resolveTenantLogoFilePath(tenantId: string, filename: string): string {
  const logosDir = resolveTenantLogosDirPath(tenantId);
  const safeFilename = sanitizeStorageSegment(path.basename(filename), 'arquivo');
  return path.resolve(logosDir, safeFilename);
}

export function resolveTenantUsersDirPath(tenantId: string): string {
  return ensureDirectory(path.join(resolveTenantUploadsRootPath(tenantId), 'users'));
}

export function resolveTenantUserAvatarDirPath(tenantId: string, userId: string): string {
  const safeUserId = sanitizeStorageSegment(userId, 'usuario');
  return ensureDirectory(path.join(resolveTenantUsersDirPath(tenantId), safeUserId, 'avatar'));
}

export function resolveTenantUserAvatarFilePath(
  tenantId: string,
  userId: string,
  filename: string,
): string {
  const avatarDir = resolveTenantUserAvatarDirPath(tenantId, userId);
  const safeFilename = sanitizeStorageSegment(path.basename(filename), 'arquivo');
  return path.resolve(avatarDir, safeFilename);
}

export function resolveTenantModuleAreaPath(
  tenantId: string,
  ...segments: string[]
): string {
  const safeSegments = segments.map((segment, index) =>
    sanitizeStorageSegment(segment, `segmento_${index + 1}`),
  );
  return ensureDirectory(path.join(resolveTenantUploadsRootPath(tenantId), 'modules', ...safeSegments));
}

export function resolveBackupsDirPath(): string {
  return ensureDirectory(resolveCanonicalPaths().backupsDir);
}

export function resolvePlatformAssetsRootPath(): string {
  return ensureDirectory(path.join(resolveUploadsDirPath(), 'platform'));
}

export function resolvePlatformLogosDirPath(): string {
  return ensureDirectory(path.join(resolvePlatformAssetsRootPath(), 'logos'));
}

export function resolvePlatformLogoFilePath(filename: string): string {
  const safeFilename = sanitizeStorageSegment(path.basename(filename), 'arquivo');
  return path.resolve(resolvePlatformLogosDirPath(), safeFilename);
}

@Injectable()
export class PathsService implements OnModuleInit {
  private readonly logger = new Logger(PathsService.name);
  private readonly paths: CanonicalPaths;

  constructor(private readonly configService: ConfigService) {
    this.paths = resolveCanonicalPaths({
      projectRoot: (this.configService.get<string>('PROJECT_ROOT') || '').trim() || undefined,
      uploadsDir: (this.configService.get<string>('UPLOADS_DIR') || '').trim() || undefined,
      backupsDir: (this.configService.get<string>('BACKUP_DIR') || '').trim() || undefined,
      logosDir: (this.configService.get<string>('LOGOS_UPLOAD_DIR') || '').trim() || undefined,
    });
  }

  onModuleInit(): void {
    this.ensureDir(this.paths.uploadsDir);
    this.ensureDir(this.paths.tenantsDir);
    this.ensureDir(this.paths.logosDir);
    this.ensureDir(this.paths.tempDir);
    this.ensureDir(this.paths.secureDir);
    this.ensureDir(this.paths.backupsDir);

    this.logger.log(`UPLOADS_DIR=${this.paths.uploadsDir}`);
    this.logger.log(`TENANTS_DIR=${this.paths.tenantsDir}`);
    this.logger.log(`BACKUP_DIR=${this.paths.backupsDir}`);
    this.logger.log(`LOGOS_DIR=${this.paths.logosDir}`);
    this.logger.log(`TEMP_DIR=${this.paths.tempDir}`);
    this.logger.log(`SECURE_DIR=${this.paths.secureDir}`);
  }

  getProjectRoot(): string {
    return this.paths.projectRoot;
  }

  getUploadsDir(): string {
    return this.paths.uploadsDir;
  }

  getTenantsDir(): string {
    return this.paths.tenantsDir;
  }

  getLogosDir(): string {
    return this.paths.logosDir;
  }

  getTempDir(): string {
    return this.paths.tempDir;
  }

  getSecureDir(): string {
    return this.paths.secureDir;
  }

  getBackupsDir(): string {
    return this.paths.backupsDir;
  }

  ensureDir(dirPath: string): string {
    return ensureDirectory(dirPath);
  }
}

function sanitizeStorageSegment(value: string, label: string): string {
  const normalized = String(value || '').trim();
  if (!normalized || !SAFE_STORAGE_SEGMENT_REGEX.test(normalized)) {
    throw new Error(`${label} invalido para armazenamento`);
  }

  return normalized;
}
