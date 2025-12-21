/**
 * NOTIFICATION SSE - Transporte SSE para notificações
 * 
 * Gerencia emissão de notificações via Server-Sent Events
 */

import { Injectable, Logger } from '@nestjs/common';
import { RealtimeBus } from '../realtime/realtime.bus';
import { RealtimeChannel, RealtimeMessage } from '../realtime/realtime.types';
import { NotificationRecord, NotificationRealtimeEvent } from './notification.types';

@Injectable()
export class NotificationSSE {
  private readonly logger = new Logger(NotificationSSE.name);

  constructor(private realtimeBus: RealtimeBus) {}

  /**
   * Emite notificação via SSE IMEDIATAMENTE
   * Esta é a linha exata onde o SSE é emitido: linha 23
   */
  async emitNotification(notification: NotificationRecord): Promise<void> {
    const startTime = Date.now();

    try {
      // Determina canal baseado na notificação
      const channel: RealtimeChannel = {
        name: 'notifications',
        tenantId: notification.tenantId,
        userId: notification.userId
      };

      // Cria evento de tempo real
      const event: NotificationRealtimeEvent = {
        type: 'notification_created',
        notification,
        tenantId: notification.tenantId,
        userId: notification.userId
      };

      // Cria mensagem de tempo real
      const message: RealtimeMessage = {
        type: 'notification',
        data: event,
        timestamp: new Date(),
        tenantId: notification.tenantId,
        userId: notification.userId
      };

      // LINHA EXATA DE EMISSÃO SSE
      await this.realtimeBus.emitSSE(channel, message);

      const duration = Date.now() - startTime;
      this.logger.log(`Notificação SSE emitida em ${duration}ms: ${notification.title}`);

    } catch (error) {
      this.logger.error(`Erro ao emitir notificação SSE: ${notification.title}`, error);
      throw error;
    }
  }

  /**
   * Emite evento de notificação lida
   */
  async emitNotificationRead(notification: NotificationRecord): Promise<void> {
    try {
      const channel: RealtimeChannel = {
        name: 'notifications',
        tenantId: notification.tenantId,
        userId: notification.userId
      };

      const event: NotificationRealtimeEvent = {
        type: 'notification_read',
        notification,
        tenantId: notification.tenantId,
        userId: notification.userId
      };

      const message: RealtimeMessage = {
        type: 'notification_read',
        data: event,
        timestamp: new Date(),
        tenantId: notification.tenantId,
        userId: notification.userId
      };

      await this.realtimeBus.emitSSE(channel, message);
      this.logger.debug(`Evento de leitura SSE emitido: ${notification.id}`);

    } catch (error) {
      this.logger.error(`Erro ao emitir evento de leitura SSE: ${notification.id}`, error);
    }
  }

  /**
   * Emite evento de notificação deletada
   */
  async emitNotificationDeleted(notification: NotificationRecord): Promise<void> {
    try {
      const channel: RealtimeChannel = {
        name: 'notifications',
        tenantId: notification.tenantId,
        userId: notification.userId
      };

      const event: NotificationRealtimeEvent = {
        type: 'notification_deleted',
        notification,
        tenantId: notification.tenantId,
        userId: notification.userId
      };

      const message: RealtimeMessage = {
        type: 'notification_deleted',
        data: event,
        timestamp: new Date(),
        tenantId: notification.tenantId,
        userId: notification.userId
      };

      await this.realtimeBus.emitSSE(channel, message);
      this.logger.debug(`Evento de exclusão SSE emitido: ${notification.id}`);

    } catch (error) {
      this.logger.error(`Erro ao emitir evento de exclusão SSE: ${notification.id}`, error);
    }
  }
}