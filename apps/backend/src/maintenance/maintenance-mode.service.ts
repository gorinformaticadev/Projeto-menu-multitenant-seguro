import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { PathsService } from '@core/common/paths/paths.service';

export type MaintenanceState = {
  enabled: boolean;
  reason: string | null;
  startedAt: string | null;
  etaSeconds: number | null;
  allowedRoles: string[];
  bypassHeader: string;
};

const DEFAULT_MAINTENANCE_STATE: MaintenanceState = {
  enabled: false,
  reason: null,
  startedAt: null,
  etaSeconds: null,
  allowedRoles: ['SUPER_ADMIN'],
  bypassHeader: 'X-Maintenance-Bypass',
};

@Injectable()
export class MaintenanceModeService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceModeService.name);

  constructor(private readonly pathsService: PathsService) {}

  onModuleInit(): void {
    this.logger.log(`MAINTENANCE_FILE=${this.getMaintenanceFilePath()}`);
  }

  getMaintenanceFilePath(): string {
    const baseDir = this.resolveBaseDir();
    return path.join(baseDir, 'shared', 'maintenance.json');
  }

  async getState(): Promise<MaintenanceState> {
    const filePath = this.getMaintenanceFilePath();
    let raw = '';

    try {
      raw = await fsp.readFile(filePath, 'utf8');
    } catch {
      return { ...DEFAULT_MAINTENANCE_STATE };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<MaintenanceState>;
      return {
        enabled: Boolean(parsed.enabled),
        reason: this.normalizeNullableString(parsed.reason),
        startedAt: this.normalizeNullableString(parsed.startedAt),
        etaSeconds: this.normalizeEtaSeconds(parsed.etaSeconds),
        allowedRoles: this.normalizeRoles(parsed.allowedRoles),
        bypassHeader: this.normalizeHeaderName(parsed.bypassHeader),
      };
    } catch (error) {
      this.logger.warn(`maintenance.json invalido em ${filePath}. detalhe=${String(error)}`);
      return {
        ...DEFAULT_MAINTENANCE_STATE,
        reason: 'maintenance.json invalido',
      };
    }
  }

  async isEnabled(): Promise<boolean> {
    const state = await this.getState();
    return state.enabled;
  }

  async writeState(state: MaintenanceState): Promise<void> {
    const filePath = this.getMaintenanceFilePath();
    await this.ensureDir(path.dirname(filePath));

    const payload: MaintenanceState = {
      enabled: Boolean(state.enabled),
      reason: this.normalizeNullableString(state.reason),
      startedAt: this.normalizeNullableString(state.startedAt),
      etaSeconds: this.normalizeEtaSeconds(state.etaSeconds),
      allowedRoles: this.normalizeRoles(state.allowedRoles),
      bypassHeader: this.normalizeHeaderName(state.bypassHeader),
    };

    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fsp.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await fsp.rename(tmpPath, filePath);
  }

  private resolveBaseDir(): string {
    const fromEnv = String(process.env.APP_BASE_DIR || '').trim();
    if (fromEnv) {
      return path.resolve(fromEnv);
    }

    const projectRoot = path.resolve(this.pathsService.getProjectRoot());
    if (path.basename(projectRoot) === 'current') {
      return path.resolve(projectRoot, '..');
    }
    if (path.basename(path.dirname(projectRoot)) === 'releases') {
      return path.resolve(projectRoot, '..', '..');
    }
    return projectRoot;
  }

  private normalizeNullableString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeEtaSeconds(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return null;
    }
    return Math.floor(numeric);
  }

  private normalizeRoles(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) {
      return [...DEFAULT_MAINTENANCE_STATE.allowedRoles];
    }

    const normalized = value
      .map((item) => String(item || '').trim().toUpperCase())
      .filter((item) => item.length > 0);

    return normalized.length > 0 ? normalized : [...DEFAULT_MAINTENANCE_STATE.allowedRoles];
  }

  private normalizeHeaderName(value: unknown): string {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : DEFAULT_MAINTENANCE_STATE.bypassHeader;
  }

  private async ensureDir(target: string): Promise<void> {
    if (!fs.existsSync(target)) {
      await fsp.mkdir(target, { recursive: true });
    }
  }
}
