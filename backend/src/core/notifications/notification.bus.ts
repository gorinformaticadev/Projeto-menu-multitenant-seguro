/**
 * NOTIFICATION BUS - Orquestrador de notificações
 * 
 * Orquestra emissão SSE + persistência sem bloquear tempo real
 */

import { Injectable, Logger } from '@nestjs/common';
import { NotificationPayload, NotificationRecord } from './notification.types';
import { NotificationSSE } from './notification.sse';
import { NotificationStore } from './notification.store';
import { NotificationPermissionsService } from './notification.permissions';

@Injectable()
export class NotificationBus {
  private readonly logger = new Logger(NotificationBus.name);

  constructor(
    private notificationSSE: NotificationSSE,
    private notificationStore: NotificationStore,
    private permissions: NotificationPermissionsService
  ) {}

  /**
   * Processa notificação: SSE IMEDIATO + persistência em background
   */
  async processNotification(payload: NotificationPayload): Promise<void> {
    const startTime = Date.now();

    try {
      // Determina audiências para a notificação
      const audiences = this.permissions.determineAudience(payload);

      // Cria registros temporários para cada audiência
      const notifications: NotificationRecord[] = audiences.map(audience => ({
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId: audience.tenantId,
        userId: audience.userId,
        title: payload.title,
        description: payload.description,
        type: payload.type,
        origin: payload.origin,
        permissions: payload.permissions,
        metadata: payload.metadata,
        read: false,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // EMITE SSE IMEDIATAMENTE (sem aguardar persistência)
      const ssePromises = notifications.map(notification => 
        this.notificationSSE.emitNotification(notification)
      );

      await Promise.allSettled(ssePromises);

      const sseDuration = Date.now() - startTime;
      this.logger.log(`SSE emitido em ${sseDuration}ms para ${notifications.length} audiência(s): ${payload.title}`);

      // PERSISTÊNCIA EM BACKGROUND (não bloqueia)
      this.notificationStore.persistAsync(payload);

    } catch (error) {
      this.logger.error(`Erro ao processar notificação: ${payload.title}`, error);
      throw error;
    }
  }

  /**
   * Processa marcação como lida
   */
  async processMarkAsRead(notificationId: string, user: any): Promise<NotificationRecord | null> {
    try {
      const notification = await this.notificationStore.markAsRead(notificationId, user);
      
      if (notification) {
        // Emite evento de leitura via SSE
        await this.notificationSSE.emitNotificationRead(notification);
      }

      return notification;
    } catch (error) {
      this.logger.error(`Erro ao marcar notificação como lida: ${notificationId}`, error);
      throw error;
    }
  }

  /**
   * Processa exclusão de notificação
   */
  async processDelete(notificationId: string, user: any): Promise<NotificationRecord | null> {
    try {
      const notification = await this.notificationStore.delete(notificationId, user);
      
      if (notification) {
        // Emite evento de exclusão via SSE
        await this.notificationSSE.emitNotificationDeleted(notification);
      }

      return notification;
    } catch (error) {
      this.logger.error(`Erro ao deletar notificação: ${notificationId}`, error);
      throw error;
    }
  }
}