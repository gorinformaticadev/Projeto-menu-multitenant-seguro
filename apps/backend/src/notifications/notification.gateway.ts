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
import { WsJwtGuard } from '@common/guards/ws-jwt.guard';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  peakConnections: number;
  connectionAttempts: number;
  failedConnections: number;
  avgConnectionDuration: number;
  connectionFailureRate: number;
}

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
    origin: (origin, callback) => {
      // Domínios de produção
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.FRONTEND_URL?.replace('https://', 'wss://'), // Protocolo WebSocket
      ].filter(Boolean);
      
      // Domínios de desenvolvimento
      if (process.env.NODE_ENV !== 'production') {
        allowedOrigins.push(
          'http://localhost:5000',
          'http://localhost:3000',
          'ws://localhost:5000',
          'ws://localhost:3000'
        );
      }
      
      // Permitir se não houver origem (apps móveis, conexões diretas) ou estiver na lista permitida
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origem não permitida: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();
  private connectionMetrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    peakConnections: 0,
    connectionAttempts: 0,
    failedConnections: 0,
    avgConnectionDuration: 0,
    connectionFailureRate: 0
  };
  private connectionStartTimes = new Map<string, number>();
  private monitoringInterval: NodeJS.Timeout;

  constructor(
    private notificationService: NotificationService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prismaService: PrismaService
  ) {
    this.startMonitoring();
  }

  private startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      try {
        this.updateMetrics();
        this.checkThresholds();
        this.logMetrics();
      } catch (error) {
        // CRÍTICO: Nunca permitir que erros de monitoramento quebrem outras operações
        this.logger.error('Erro no monitoramento do gateway (não crítico):', error);
      }
    }, 60000); // A cada minuto
  }

  private updateMetrics() {
    try {
      const currentActive = this.connectedClients.size;
      this.connectionMetrics.activeConnections = currentActive;
      this.connectionMetrics.peakConnections = Math.max(
        this.connectionMetrics.peakConnections,
        currentActive
      );

      // Calcular taxa de falha
      if (this.connectionMetrics.connectionAttempts > 0) {
        this.connectionMetrics.connectionFailureRate = 
          (this.connectionMetrics.failedConnections / this.connectionMetrics.connectionAttempts) * 100;
      }
    } catch (error) {
      this.logger.error('Erro ao atualizar métricas:', error);
    }
  }

  private checkThresholds() {
    try {
      const maxConnections = parseInt(process.env.MAX_WEBSOCKET_CONNECTIONS) || 1000;
      
      // Alertar sobre uso alto de conexões
      if (this.connectionMetrics.activeConnections > maxConnections * 0.8) {
        this.logger.warn('ALTO_USO_CONEXOES', {
          active: this.connectionMetrics.activeConnections,
          threshold: maxConnections * 0.8,
          percentage: (this.connectionMetrics.activeConnections / maxConnections * 100).toFixed(2)
        });
      }

      // Alertar sobre alta taxa de falhas - APENAS LOG, NUNCA THROW
      if (this.connectionMetrics.connectionFailureRate > 5) {
        this.logger.warn('ALTA_TAXA_FALHAS_CONEXAO', {
          connectionFailureRate: this.connectionMetrics.connectionFailureRate,
          failedConnections: this.connectionMetrics.failedConnections,
          connectionAttempts: this.connectionMetrics.connectionAttempts
        });
        
        // CRÍTICO: NUNCA fazer throw aqui - apenas log
        // Isso estava causando o HTTP 500 anteriormente
      }
    } catch (error) {
      // CRÍTICO: Capturar QUALQUER erro e apenas logar
      this.logger.error('Erro ao verificar thresholds (não crítico):', error);
      // NUNCA re-throw o erro
    }
  }

  private logMetrics() {
    try {
      this.logger.log('METRICAS_CONEXOES', {
        ...this.connectionMetrics,
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      });
    } catch (error) {
      this.logger.error('Erro ao logar métricas:', error);
    }
  }

  // Lifecycle hook para limpeza
  onModuleDestroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Rastrear início da conexão para métricas
      this.connectionMetrics.totalConnections++;
      this.connectionMetrics.connectionAttempts++;
      this.connectionStartTimes.set(client.id, Date.now());

      // DEBUG: Verificar se o token está sendo enviado
      this.logger.log(`🔍 Cliente conectando: ${client.id}`);
      this.logger.log(`🔍 Handshake auth:`, client.handshake?.auth);
      this.logger.log(`🔍 Handshake headers:`, client.handshake?.headers?.authorization);

      // AUTENTICAÇÃO DIRETA: Extrair e validar token
      const token = this.extractTokenFromHandshake(client);
      if (!token) {
        this.logger.warn(`❌ Cliente rejeitado - nenhum token fornecido: ${client.id}`);
        this.connectionMetrics.failedConnections++;
        client.disconnect(true);
        return;
      }

      // Validar token JWT
      const user = await this.validateTokenForConnection(token);
      if (!user) {
        this.logger.warn(`❌ Cliente rejeitado - token inválido: ${client.id}`);
        this.connectionMetrics.failedConnections++;
        client.disconnect(true);
        return;
      }

      // Anexar usuário ao cliente
      (client as any).user = user;
      this.logger.log(`✅ Cliente autenticado: ${client.id} (user: ${user.id}, tenant: ${user.tenantId})`);

      this.connectedClients.set(client.id, client);

      // Entrar nas salas apropriadas
      await this.joinRooms(client);

      this.logger.log(`Cliente conectado: ${client.id} (user: ${user.id}, tenant: ${user.tenantId})`);
      
      // Enviar contagem de não lidas
      const unreadCount = await this.notificationService.countUnread(user);
      client.emit('notification:unread-count', { count: unreadCount });

    } catch (error) {
      this.logger.error(`Erro na conexão do cliente ${client.id}:`, error);
      this.connectionMetrics.failedConnections++;
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // Calcular duração da conexão
    const startTime = this.connectionStartTimes.get(client.id);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.connectionMetrics.avgConnectionDuration = 
        ((this.connectionMetrics.avgConnectionDuration * (this.connectionMetrics.totalConnections - 1)) + duration) 
        / this.connectionMetrics.totalConnections;
      
      this.connectionStartTimes.delete(client.id);
    }
    
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
      this.logger.error(`Erro ao marcar notificação como lida: ${data.id}`, {
        error: error.message,
        stack: error.stack,
        clientId: client.id,
        userId: client.user?.id,
        timestamp: new Date().toISOString()
      });
      client.emit('notification:error', { 
        message: 'Não foi possível processar a solicitação',
        code: 'MARK_READ_FAILED'
      });
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
      this.logger.error('Erro ao marcar todas como lidas:', {
        error: error.message,
        stack: error.stack,
        clientId: client.id,
        userId: client.user?.id,
        timestamp: new Date().toISOString()
      });
      client.emit('notification:error', { 
        message: 'Não foi possível processar a solicitação',
        code: 'MARK_ALL_READ_FAILED'
      });
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
      this.logger.error(`Erro ao deletar notificação: ${data.id}`, {
        error: error.message,
        stack: error.stack,
        clientId: client.id,
        userId: client.user?.id,
        timestamp: new Date().toISOString()
      });
      client.emit('notification:error', { 
        message: 'Não foi possível processar a solicitação',
        code: 'DELETE_NOTIFICATION_FAILED'
      });
    }
  }

  /**
   * Emite nova notificação para usuários apropriados
   * CRÍTICO: Nunca deve falhar ou quebrar requisições HTTP
   */
  async emitNewNotification(notification: Notification) {
    try {
      const rooms = this.determineTargetRooms(notification);
      
      for (const room of rooms) {
        try {
          this.server.to(room).emit('notification:new', notification);
          this.logger.log(`Nova notificação emitida para sala: ${room}`);
        } catch (roomError) {
          // CRÍTICO: Erro em uma sala não deve afetar outras
          this.logger.error(`Erro ao emitir para sala ${room}:`, roomError);
        }
      }

      // Atualizar contagem de não lidas para usuários afetados
      try {
        await this.updateUnreadCounts(notification);
      } catch (countError) {
        // CRÍTICO: Erro na contagem não deve quebrar a emissão
        this.logger.error('Erro ao atualizar contagens (não crítico):', countError);
      }
      
    } catch (error) {
      // CRÍTICO: NUNCA permitir que este método falhe
      this.logger.error('Erro ao emitir nova notificação (não crítico):', error);
      // NUNCA re-throw - isso quebraria requisições HTTP
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

  private extractTokenFromHandshake(client: AuthenticatedSocket): string | null {
    return client.handshake?.auth?.token ||
           client.handshake?.headers?.authorization?.replace('Bearer ', '') ||
           null;
  }

  private async validateTokenForConnection(token: string): Promise<any> {
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
      this.logger.error('Erro ao validar token JWT para conexão:', error.message);
      return null;
    }
  }

  private async validateToken(token: string): Promise<unknown> {
    // Método legado - manter para compatibilidade
    return this.validateTokenForConnection(token);
  }
}