import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { RequestSecurityContextService } from '@common/services/request-security-context.service';

const DEFAULT_PRISMA_RECONNECT_TIMEOUT_MS = 60000;
const DEFAULT_PRISMA_RECONNECT_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;
const TENANT_SCOPED_MODELS = new Set([
  'AuditLog',
  'BackupArtifact',
  'BackupJob',
  'BackupLog',
  'BackupRestoreLog',
  'DashboardLayout',
  'ModuleTenant',
  'Notification',
  'PushSubscription',
  'SecureFile',
  'SystemSetting',
  'User',
  'UserSession',
]);
const FIND_UNIQUE_ACTION_REWRITES: Record<string, Prisma.PrismaAction> = {
  findUnique: 'findFirst',
  findUniqueOrThrow: 'findFirstOrThrow',
};

type PrismaMiddlewareParams = {
  model?: string;
  action: Prisma.PrismaAction;
  args?: {
    where?: unknown;
    data?: unknown;
    create?: unknown;
    update?: unknown;
  } & Record<string, unknown>;
};

type PrismaMiddlewareNext = (params: PrismaMiddlewareParams) => Promise<unknown>;

type PrismaMiddlewareCapable = {
  $use?: (middleware: (params: PrismaMiddlewareParams, next: PrismaMiddlewareNext) => Promise<unknown>) => void;
};

export class PrismaReconnectFailed extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly timeoutMs: number,
    public readonly lastError?: unknown,
  ) {
    super(message);
    this.name = 'PrismaReconnectFailed';
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private cutoverBlocked = false;
  private connected = false;

  constructor(
    private readonly requestSecurityContext: RequestSecurityContextService = new RequestSecurityContextService(),
  ) {
    super();
    (this as unknown as PrismaMiddlewareCapable).$use?.((params, next) =>
      this.applyTenantEnforcement(params, next),
    );
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async $connect(): Promise<void> {
    if (this.cutoverBlocked) {
      throw new Error('Prisma reconnect blocked during restore cutover');
    }
    if (this.connected) {
      return;
    }
    await super.$connect();
    this.connected = true;
  }

  async $disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }
    await super.$disconnect();
    this.connected = false;
  }

  isCutoverBlocked(): boolean {
    return this.cutoverBlocked;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    await this.$disconnect();
  }

  async connect(): Promise<void> {
    await this.$connect();
  }

  async quiesceForCutover(): Promise<void> {
    if (this.cutoverBlocked) {
      return;
    }
    this.cutoverBlocked = true;
    try {
      await this.$disconnect();
    } catch (error) {
      this.logger.warn(`Falha ao desconectar Prisma no quiesce: ${String(error)}`);
    }
  }

  async resumeAfterCutover(): Promise<void> {
    this.cutoverBlocked = false;
    const timeoutMs = this.readPositiveIntFromEnv(
      'PRISMA_RECONNECT_TIMEOUT_MS',
      DEFAULT_PRISMA_RECONNECT_TIMEOUT_MS,
    );
    const baseBackoffMs = this.readPositiveIntFromEnv(
      'PRISMA_RECONNECT_BACKOFF_MS',
      DEFAULT_PRISMA_RECONNECT_BACKOFF_MS,
    );
    const deadline = Date.now() + timeoutMs;

    let attempts = 0;
    let lastError: unknown = null;

    while (Date.now() <= deadline) {
      attempts += 1;
      try {
        await this.$connect();
        return;
      } catch (error) {
        lastError = error;
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        break;
      }

      const expBackoff = Math.min(baseBackoffMs * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
      const jitterMs = Math.floor(expBackoff * 0.15 * Math.random());
      const waitMs = Math.max(1, Math.min(remaining, expBackoff + jitterMs));

      this.logger.warn(
        `Tentativa ${attempts} de reconexao Prisma apos cutover falhou. Nova tentativa em ${waitMs}ms`,
      );
      await this.wait(waitMs);
    }

    throw new PrismaReconnectFailed(
      `Falha ao reconectar Prisma apos cutover em ${timeoutMs}ms`,
      attempts,
      timeoutMs,
      lastError || undefined,
    );
  }

  private readPositiveIntFromEnv(envName: string, fallback: number): number {
    const raw = String(process.env[envName] || '').trim();
    const parsed = Number(raw);
    if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async applyTenantEnforcement(
    params: PrismaMiddlewareParams,
    next: PrismaMiddlewareNext,
  ): Promise<unknown> {
    if (!params.model || !TENANT_SCOPED_MODELS.has(params.model)) {
      return next(params);
    }

    if (!this.requestSecurityContext.shouldEnforceTenantScope()) {
      return next(params);
    }

    const tenantId = this.requestSecurityContext.getTenantId();
    if (!tenantId) {
      throw new Error(`Tenant scope missing for ${params.model}.${params.action}`);
    }

    switch (params.action) {
      case 'findUnique':
      case 'findUniqueOrThrow':
        params.action = FIND_UNIQUE_ACTION_REWRITES[params.action];
        params.args = {
          ...(params.args || {}),
          where: this.combineWhereWithTenant(params.args?.where, tenantId),
        };
        return next(params);
      case 'findFirst':
      case 'findFirstOrThrow':
      case 'findMany':
      case 'count':
      case 'aggregate':
      case 'updateMany':
      case 'deleteMany':
        params.args = {
          ...(params.args || {}),
          where: this.combineWhereWithTenant(params.args?.where, tenantId),
        };
        return next(params);
      case 'create':
        params.args = {
          ...(params.args || {}),
          data: this.injectTenantIntoData(params.args?.data, tenantId, params.model),
        };
        return next(params);
      case 'createMany':
        params.args = {
          ...(params.args || {}),
          data: this.injectTenantIntoCreateMany(params.args?.data, tenantId, params.model),
        };
        return next(params);
      case 'update':
      case 'delete':
        await this.assertTenantScopedRecordExists(params.model, params.args?.where, tenantId, params.action);
        this.assertTenantMutationData(params.args?.data, tenantId, params.model, params.action);
        return next(params);
      case 'upsert':
        await this.assertTenantScopedRecordExists(params.model, params.args?.where, tenantId, params.action, true);
        params.args = {
          ...(params.args || {}),
          create: this.injectTenantIntoData(params.args?.create, tenantId, params.model),
          update: this.assertTenantMutationData(
            params.args?.update,
            tenantId,
            params.model,
            params.action,
          ),
        };
        return next(params);
      default:
        return next(params);
    }
  }

  private combineWhereWithTenant(where: unknown, tenantId: string): Record<string, unknown> {
    if (!where || typeof where !== 'object') {
      return { tenantId };
    }

    return {
      AND: [where as Record<string, unknown>, { tenantId }],
    };
  }

  private injectTenantIntoData(
    data: unknown,
    tenantId: string,
    model: string,
  ): Record<string, unknown> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`Tenant scope missing for ${model}.create`);
    }

    const payload = { ...(data as Record<string, unknown>) };
    const explicitTenantId =
      typeof payload.tenantId === 'string' && payload.tenantId.trim().length > 0
        ? payload.tenantId.trim()
        : null;

    if (explicitTenantId && explicitTenantId !== tenantId) {
      throw new Error(`Tenant scope mismatch for ${model}.create`);
    }

    payload.tenantId = tenantId;
    return payload;
  }

  private injectTenantIntoCreateMany(
    data: unknown,
    tenantId: string,
    model: string,
  ): Array<Record<string, unknown>> | Record<string, unknown> {
    if (Array.isArray(data)) {
      return data.map((entry) => this.injectTenantIntoData(entry, tenantId, model));
    }

    return this.injectTenantIntoData(data, tenantId, model);
  }

  private assertTenantMutationData(
    data: unknown,
    tenantId: string,
    model: string,
    action: string,
  ): Record<string, unknown> | undefined {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return data as Record<string, unknown> | undefined;
    }

    const payload = { ...(data as Record<string, unknown>) };
    const explicitTenantId =
      typeof payload.tenantId === 'string' && payload.tenantId.trim().length > 0
        ? payload.tenantId.trim()
        : null;

    if (explicitTenantId && explicitTenantId !== tenantId) {
      throw new Error(`Tenant scope mismatch for ${model}.${action}`);
    }

    if (explicitTenantId) {
      payload.tenantId = tenantId;
    }

    return payload;
  }

  private async assertTenantScopedRecordExists(
    model: string,
    where: unknown,
    tenantId: string,
    action: string,
    allowMissing = false,
  ): Promise<void> {
    if (!where || typeof where !== 'object') {
      throw new Error(`Tenant scope missing for ${model}.${action}`);
    }

    const delegate = this.resolveModelDelegate(model);
    const scopedWhere = this.combineWhereWithTenant(where, tenantId);
    const record = await this.requestSecurityContext.runWithoutTenantEnforcement(
      `prisma-tenant-preflight:${model}.${action}`,
      () =>
        delegate.findFirst({
          where: scopedWhere,
          select: { id: true, tenantId: true },
        }),
    );

    if (!record && !allowMissing) {
      throw new Error(`Tenant scope missing for ${model}.${action}`);
    }
  }

  private resolveModelDelegate(model: string): {
    findFirst: (args: Record<string, unknown>) => Promise<unknown>;
  } {
    const delegateName = model.charAt(0).toLowerCase() + model.slice(1);
    const delegate = (this as unknown as Record<string, unknown>)[delegateName] as {
      findFirst?: (args: Record<string, unknown>) => Promise<unknown>;
    };
    if (!delegate?.findFirst) {
      throw new Error(`Prisma delegate not found for model ${model}`);
    }

    return delegate as { findFirst: (args: Record<string, unknown>) => Promise<unknown> };
  }
}
