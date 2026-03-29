import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as os from 'os';
import { UpdateExecutionBridgeService } from './update-execution-bridge.service';
import { UpdateExecutionLeaseService } from './update-execution-lease.service';
import { UpdateExecutionRepository } from './update-execution.repository';
import { UpdateStateMachineService } from './update-state-machine.service';

@Injectable()
export class UpdateAgentRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UpdateAgentRunnerService.name);
  private readonly installationId = this.resolveInstallationId();
  private readonly ttlSeconds = this.readPositiveIntEnv('UPDATE_AGENT_LEASE_TTL_SECONDS', 45);
  private readonly pollIntervalMs = this.readPositiveIntEnv('UPDATE_AGENT_POLL_INTERVAL_MS', 10_000);
  private readonly runnerIdentity = this.leaseService.createRunnerIdentity();
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;

  constructor(
    private readonly leaseService: UpdateExecutionLeaseService,
    private readonly repository: UpdateExecutionRepository,
    private readonly bridgeService: UpdateExecutionBridgeService,
    private readonly stateMachine: UpdateStateMachineService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const acquired = await this.leaseService.tryAcquire({
      installationId: this.installationId,
      runnerId: this.runnerIdentity.runnerId,
      leaseToken: this.runnerIdentity.leaseToken,
      ttlSeconds: this.ttlSeconds,
    });

    if (!acquired) {
      this.logger.warn('Outro update-agent ja possui o lease desta instalacao. Runner atual ficara ocioso.');
      return;
    }

    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.isEnabled()) {
      await this.leaseService.release(this.installationId, this.runnerIdentity.runnerId);
    }
  }

  private async tick(): Promise<void> {
    if (this.inFlight) {
      return;
    }

    this.inFlight = true;
    try {
      const renewed = await this.leaseService.renew({
        installationId: this.installationId,
        runnerId: this.runnerIdentity.runnerId,
        ttlSeconds: this.ttlSeconds,
      });

      if (!renewed) {
        this.logger.warn('Lease do update-agent nao pode ser renovado. Encerrando polling.');
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        return;
      }

      if (!this.bridgeService.isEnabled() || process.env.UPDATE_AGENT_LEGACY_BRIDGE_ENABLED !== 'true') {
        return;
      }

      const pending = await this.repository.findNextRequestedExecution(this.installationId);
      if (!pending) {
        return;
      }

      await this.leaseService.renew({
        installationId: this.installationId,
        runnerId: this.runnerIdentity.runnerId,
        executionId: pending.id,
        ttlSeconds: this.ttlSeconds,
      });

      await this.bridgeService.launchLegacyExecution({
        execution: this.stateMachine.buildExecutionView(pending),
        version: pending.targetVersion,
        userId: pending.requestedBy || 'system',
        userEmail: typeof pending.metadata?.['userEmail'] === 'string' ? String(pending.metadata['userEmail']) : undefined,
        userRole: typeof pending.metadata?.['userRole'] === 'string' ? String(pending.metadata['userRole']) : undefined,
        ipAddress: typeof pending.metadata?.['ipAddress'] === 'string' ? String(pending.metadata['ipAddress']) : undefined,
        userAgent: typeof pending.metadata?.['userAgent'] === 'string' ? String(pending.metadata['userAgent']) : undefined,
      });
    } catch (error) {
      this.logger.warn(`Falha no loop do update-agent: ${String(error)}`);
    } finally {
      this.inFlight = false;
    }
  }

  private isEnabled(): boolean {
    return process.env.UPDATE_AGENT_ENABLED === 'true';
  }

  private resolveInstallationId(): string {
    const explicit = String(process.env.UPDATE_INSTALLATION_ID || '').trim();
    if (explicit) {
      return explicit;
    }

    const host = String(process.env.HOSTNAME || os.hostname() || '').trim();
    if (host) {
      return host;
    }

    return 'default-installation';
  }

  private readPositiveIntEnv(name: string, fallback: number): number {
    const raw = String(process.env[name] || '').trim();
    const parsed = Number(raw);
    if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
