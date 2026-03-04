import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const DEFAULT_PRISMA_RECONNECT_TIMEOUT_MS = 60000;
const DEFAULT_PRISMA_RECONNECT_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;

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

  constructor() {
    super();
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
}
