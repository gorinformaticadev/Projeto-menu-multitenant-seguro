import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
    await this.$connect();
  }
}
