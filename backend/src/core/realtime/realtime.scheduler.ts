/**
 * REALTIME SCHEDULER - Manutenção de conexões SSE
 * 
 * Serviço que mantém conexões SSE vivas com pings periódicos
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RealtimeBus } from './realtime.bus';

@Injectable()
export class RealtimeScheduler {
  private readonly logger = new Logger(RealtimeScheduler.name);

  constructor(private realtimeBus: RealtimeBus) {}

  /**
   * Ping conexões SSE a cada 30 segundos para mantê-las vivas
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async pingSSEConnections() {
    try {
      await this.realtimeBus.pingConnections();
      
      const stats = this.realtimeBus.getConnectionStats();
      if (stats.total > 0) {
        this.logger.debug(`Ping enviado para ${stats.total} conexão(ões) SSE`);
      }
    } catch (error) {
      this.logger.error('Erro ao fazer ping das conexões SSE:', error);
    }
  }
}