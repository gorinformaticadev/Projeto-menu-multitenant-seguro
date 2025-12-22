/**
 * NOTIFICATION GATEWAY - Socket.IO Gateway para notificações em tempo real
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    tenantId: string;
    role: string;
  };
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private notificationService: NotificationService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prismaService: PrismaService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extrair token do handshake
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn(`Cliente rejeitado - sem token: ${client.id}`);
        client.disconnect();
        return;
      }

      // Aqui você validaria o JWT token e extrairia o usuário
      // Por simplicidade, vou assumir que o token é válido
      // Em produção, use o JwtService para validar
      
      // Mock de usuário - SUBSTITUIR por validação real do JWT
      const user = await this.validateToken(token);
      if (!user) {
        this.logger.warn(`Cliente rejeitado - token inválido: ${client.id}`);
        client.disconnect();
        return;
      }

      client.user = user;
      this.connectedClients.set(client.id, client);

      // Entrar nas salas apropriadas
      await this.joinRooms(client);

      this.logger.log(`Cliente conectado: ${client.id} (user: ${user.id}, tenant: ${user.tenantId})`);
      
      // Enviar contagem de não lidas
      const unreadCount = await this.notificationService.countUnread(user);
      client.emit('notification:unread-count', { count: unreadCount });

    } catch (error) {
      this.logger.error(`Erro na conexão do cliente ${client.id}:`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('notification:mark-read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string }
  ) {
    try {
      const notification = await this.notificationService.markAsRead(data.id, client.user);
      
      if (notification) {
        // Emitir para o usuário que a notificação foi lida
        client.emit('notification:read', notification);
        
        // Emitir nova contagem de não lidas
        const unreadCount = await this.notificationService.countUnread(client.user);
        client.emit('notification:unread-count', { count: unreadCount });
        
        this.logger.log(`Notificação marcada como lida via Socket.IO: ${data.id}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao marcar notificação como lida: ${data.id}`, error);
      client.emit('notification:error', { message: 'Erro ao marcar como lida' });
    }
  }

  @SubscribeMessage('notification:mark-all-read')
  async handleMarkAllAsRead(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const count = await this.notificationService.markAllAsRead(client.user);
      
      // Emitir confirmação
      client.emit('notification:all-read', { count });
      
      // Emitir nova contagem (deve ser 0)
      client.emit('notification:unread-count', { count: 0 });
      
      this.logger.log(`${count} notificações marcadas como lidas via Socket.IO`);
    } catch (error) {
      this.logger.error('Erro ao marcar todas como lidas:', error);
      client.emit('notification:error', { message: 'Erro ao marcar todas como lidas' });
    }
  }

  @SubscribeMessage('notification:delete')
  async handleDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string }
  ) {
    try {
      const notification = await this.notificationService.delete(data.id, client.user);
      
      if (notification) {
        // Emitir confirmação de exclusão
        client.emit('notification:deleted', { id: data.id });
        
        // Atualizar contagem se era não lida
        if (!notification.read) {
          const unreadCount = await this.notificationService.countUnread(client.user);
          client.emit('notification:unread-count', { count: unreadCount });
        }
        
        this.logger.log(`Notificação deletada via Socket.IO: ${data.id}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao deletar notificação: ${data.id}`, error);
      client.emit('notification:error', { message: 'Erro ao deletar notificação' });
    }
  }

  /**
   * Emite nova notificação para usuários apropriados
   */
  async emitNewNotification(notification: Notification) {
    try {
      const rooms = this.determineTargetRooms(notification);
      
      for (const room of rooms) {
        this.server.to(room).emit('notification:new', notification);
        this.logger.log(`Nova notificação emitida para sala: ${room}`);
      }

      // Atualizar contagem de não lidas para usuários afetados
      await this.updateUnreadCounts(notification);
      
    } catch (error) {
      this.logger.error('Erro ao emitir nova notificação:', error);
    }
  }

  /**
   * Emite evento de notificação lida
   */
  async emitNotificationRead(notification: Notification) {
    try {
      const rooms = this.determineTargetRooms(notification);
      
      for (const room of rooms) {
        this.server.to(room).emit('notification:read', notification);
      }
      
    } catch (error) {
      this.logger.error('Erro ao emitir notificação lida:', error);
    }
  }

  /**
   * Emite evento de notificação deletada
   */
  async emitNotificationDeleted(notificationId: string, notification: Notification) {
    try {
      const rooms = this.determineTargetRooms(notification);
      
      for (const room of rooms) {
        this.server.to(room).emit('notification:deleted', { id: notificationId });
      }
      
    } catch (error) {
      this.logger.error('Erro ao emitir notificação deletada:', error);
    }
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  private async joinRooms(client: AuthenticatedSocket) {
    const user = client.user;
    
    // Sala do usuário específico
    await client.join(`user:${user.id}`);
    
    // Sala do tenant (para admins)
    if (user.tenantId) {
      await client.join(`tenant:${user.tenantId}`);
    }
    
    // Sala global (para super admins)
    if (user.role === 'SUPER_ADMIN') {
      await client.join('global');
    }
    
    this.logger.debug(`Cliente ${client.id} entrou nas salas apropriadas`);
  }

  private determineTargetRooms(notification: Notification): string[] {
    const rooms: string[] = [];
    
    // Notificação para usuário específico
    if (notification.userId) {
      rooms.push(`user:${notification.userId}`);
    }
    // Notificação para tenant
    else if (notification.tenantId) {
      rooms.push(`tenant:${notification.tenantId}`);
    }
    // Notificação global
    else {
      rooms.push('global');
    }
    
    return rooms;
  }

  private async updateUnreadCounts(notification: Notification) {
    try {
      // Determinar quais usuários devem receber atualização de contagem
      const targetUsers = await this.getTargetUsers(notification);
      
      for (const userId of targetUsers) {
        const client = Array.from(this.connectedClients.values())
          .find(c => c.user?.id === userId);
        
        if (client) {
          const unreadCount = await this.notificationService.countUnread(client.user);
          client.emit('notification:unread-count', { count: unreadCount });
        }
      }
    } catch (error) {
      this.logger.error('Erro ao atualizar contagens:', error);
    }
  }

  private async getTargetUsers(notification: Notification): Promise<string[]> {
    // Implementar lógica para determinar usuários que devem receber a notificação
    // Por simplicidade, retornando apenas o usuário específico se houver
    if (notification.userId) {
      return [notification.userId];
    }
    
    // Para notificações de tenant, você precisaria buscar todos os usuários do tenant
    // Para notificações globais, todos os super admins
    
    return [];
  }

  private async validateToken(token: string): Promise<any> {
    try {
      // Validar JWT token usando o JwtService
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      if (!payload.sub) {
        return null;
      }

      // Buscar usuário no banco de dados
      const user = await this.prismaService.user.findUnique({
        where: { id: payload.sub },
        include: {
          tenant: true
        }
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name
      };
    } catch (error) {
      this.logger.error('Erro ao validar token JWT:', error.message);
      return null;
    }
  }
}