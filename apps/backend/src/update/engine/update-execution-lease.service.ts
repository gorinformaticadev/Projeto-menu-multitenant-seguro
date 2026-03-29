import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UpdateExecutionRepository } from './update-execution.repository';

@Injectable()
export class UpdateExecutionLeaseService {
  private readonly logger = new Logger(UpdateExecutionLeaseService.name);

  constructor(private readonly repository: UpdateExecutionRepository) {}

  createRunnerIdentity(): { runnerId: string; leaseToken: string } {
    return {
      runnerId: randomUUID(),
      leaseToken: randomUUID(),
    };
  }

  async tryAcquire(params: {
    installationId: string;
    runnerId: string;
    leaseToken: string;
    executionId?: string | null;
    ttlSeconds: number;
  }): Promise<boolean> {
    try {
      return await this.repository.tryAcquireRunnerLease(params);
    } catch (error) {
      this.logger.warn(`Falha ao adquirir lease do update-agent: ${String(error)}`);
      return false;
    }
  }

  async renew(params: {
    installationId: string;
    runnerId: string;
    executionId?: string | null;
    ttlSeconds: number;
  }): Promise<boolean> {
    try {
      return await this.repository.renewRunnerLease(params);
    } catch (error) {
      this.logger.warn(`Falha ao renovar lease do update-agent: ${String(error)}`);
      return false;
    }
  }

  async release(installationId: string, runnerId: string): Promise<void> {
    try {
      await this.repository.releaseRunnerLease(installationId, runnerId);
    } catch (error) {
      this.logger.warn(`Falha ao liberar lease do update-agent: ${String(error)}`);
    }
  }
}
