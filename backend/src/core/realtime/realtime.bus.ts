/**
 * REALTIME BUS - Abstração SSE/Socket.IO
 * 
 * Orquestra comunicação em tempo real entre SSE e Socket.IO
 */

import { Injectable, Logger } from '@nestjs/common';
import { RealtimeMessage, RealtimeChannel, SSEConnection, SSEMessage } from './realtime.types';

@Injectable()
export class RealtimeBus {
  private readonly logger = new Logger(RealtimeBus.name);
  private sseConnections = new Map<string, SSEConnection>();

  /**
   * Emite mensagem via SSE para canais específicos
   */
  async emitSSE(channel: RealtimeChannel, message: RealtimeMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      const targetConnections = this.getTargetConnections(channel);
      
      if (targetConnections.length === 0) {
        this.logger.debug(`Nenhuma conexão SSE encontrada para canal: ${channel.name}`);
        return;
      }

      const sseMessage: SSEMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event: message.type,
        data: JSON.stringify({
          ...message.data,
          timestamp: message.timestamp.toISOString(),
          channel: channel.name
        })
      };

      const promises = targetConnections.map(conn => this.sendSSEMessage(conn, sseMessage));
      await Promise.allSettled(promises);

      const duration = Date.now() - startTime;
      this.logger.log(`SSE emitido em ${duration}ms para ${targetConnections.length} conexão(ões) no canal ${channel.name}`);
      
    } catch (error) {
      this.logger.error(`Erro ao emitir SSE para canal ${channel.name}:`, error);
      throw error;
    }
  }

  /**
   * Registra nova conexão SSE
   */
  registerSSEConnection(connectionId: string, response: any, tenantId?: string | null, userId?: string | null): void {
    const connection: SSEConnection = {
      id: connectionId,
      tenantId,
      userId,
      response,
      lastPing: new Date()
    };

    this.sseConnections.set(connectionId, connection);
    this.logger.log(`Conexão SSE registrada: ${connectionId} (tenant: ${tenantId}, user: ${userId})`);

    // Configura headers SSE
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Envia ping inicial
    this.sendSSEMessage(connection, {
      event: 'connected',
      data: JSON.stringify({ connectionId, timestamp: new Date().toISOString() })
    });

    // Configura cleanup quando conexão fecha
    response.on('close', () => {
      this.unregisterSSEConnection(connectionId);
    });
  }

  /**
   * Remove conexão SSE
   */
  unregisterSSEConnection(connectionId: string): void {
    if (this.sseConnections.has(connectionId)) {
      this.sseConnections.delete(connectionId);
      this.logger.log(`Conexão SSE removida: ${connectionId}`);
    }
  }

  /**
   * Envia ping para manter conexões vivas
   */
  async pingConnections(): Promise<void> {
    const now = new Date();
    const staleConnections: string[] = [];

    for (const [connectionId, connection] of this.sseConnections) {
      const timeSinceLastPing = now.getTime() - connection.lastPing.getTime();
      
      if (timeSinceLastPing > 300000) { // 5 minutos
        staleConnections.push(connectionId);
        continue;
      }

      try {
        await this.sendSSEMessage(connection, {
          event: 'ping',
          data: JSON.stringify({ timestamp: now.toISOString() })
        });
        connection.lastPing = now;
      } catch (error) {
        staleConnections.push(connectionId);
      }
    }

    // Remove conexões obsoletas
    staleConnections.forEach(id => this.unregisterSSEConnection(id));
  }

  /**
   * Obtém estatísticas das conexões
   */
  getConnectionStats(): { total: number; byTenant: Record<string, number>; byUser: Record<string, number> } {
    const stats = {
      total: this.sseConnections.size,
      byTenant: {} as Record<string, number>,
      byUser: {} as Record<string, number>
    };

    for (const connection of this.sseConnections.values()) {
      if (connection.tenantId) {
        stats.byTenant[connection.tenantId] = (stats.byTenant[connection.tenantId] || 0) + 1;
      }
      if (connection.userId) {
        stats.byUser[connection.userId] = (stats.byUser[connection.userId] || 0) + 1;
      }
    }

    return stats;
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  private getTargetConnections(channel: RealtimeChannel): SSEConnection[] {
    const connections: SSEConnection[] = [];

    for (const connection of this.sseConnections.values()) {
      if (this.shouldReceiveMessage(connection, channel)) {
        connections.push(connection);
      }
    }

    return connections;
  }

  private shouldReceiveMessage(connection: SSEConnection, channel: RealtimeChannel): boolean {
    // Se canal especifica usuário, só envia para esse usuário
    if (channel.userId) {
      return connection.userId === channel.userId;
    }

    // Se canal especifica tenant, só envia para usuários desse tenant
    if (channel.tenantId) {
      return connection.tenantId === channel.tenantId;
    }

    // Canal global - envia para todos
    return true;
  }

  private async sendSSEMessage(connection: SSEConnection, message: SSEMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        let data = '';
        
        if (message.id) {
          data += `id: ${message.id}\n`;
        }
        
        if (message.event) {
          data += `event: ${message.event}\n`;
        }
        
        data += `data: ${message.data}\n\n`;

        connection.response.write(data);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}