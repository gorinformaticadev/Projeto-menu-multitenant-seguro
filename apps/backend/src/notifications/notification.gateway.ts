/**
 * NOTIFICATION GATEWAY - Socket.IO Gateway para notificacoes em tempo real
 */

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@core/prisma/prisma.service';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';
import { PushNotificationService } from './push-notification.service';
import { WebsocketRuntimeToggleService } from '@common/services/websocket-runtime-toggle.service';
import { ACCESS_TOKEN_COOKIE_NAME } from '../auth/auth-cookie.constants';
import {
  AuthenticatedSessionActor,
  AuthValidationService,
} from '../auth/auth-validation.service';
import { RequestSecurityContextService } from '@common/services/request-security-context.service';
import { WebsocketConnectionRegistryService } from '@common/services/websocket-connection-registry.service';
import { sanitizeSensitiveData } from '@common/utils/sanitize-sensitive-data.util';
import { AuthorizationService } from '@common/services/authorization.service';
import { DtoMapperService } from '@common/services/dto-mapper.service';
import { SystemNotificationDto } from './dto/system-notifications.dto';

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  peakConnections: number;
  connectionAttempts: number;
  failedConnections: number;
  avgConnectionDuration: number;
  connectionFailureRate: number;
}

interface EmitNotificationOptions {
  push?: boolean;
}

interface AuthenticatedSocket extends Socket {
  user?: AuthenticatedSessionActor;
  accessToken?: string;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.FRONTEND_URL?.replace('https://', 'wss://'),
      ].filter(Boolean);

      if (process.env.NODE_ENV !== 'production') {
        allowedOrigins.push(
          'http://localhost:5000',
          'http://localhost:3000',
          'ws://localhost:5000',
          'ws://localhost:3000',
          'http://127.0.0.1:5000',
          'http://127.0.0.1:3000',
        );
      }

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origem nao permitida: ${origin}`));
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
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private readonly connectionMetrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    peakConnections: 0,
    connectionAttempts: 0,
    failedConnections: 0,
    avgConnectionDuration: 0,
    connectionFailureRate: 0,
  };
  private readonly connectionStartTimes = new Map<string, number>();
  private monitoringInterval: NodeJS.Timeout;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly authValidationService: AuthValidationService,
    private readonly prismaService: PrismaService,
    private readonly websocketRuntimeToggleService: WebsocketRuntimeToggleService,
    private readonly requestSecurityContext: RequestSecurityContextService,
    private readonly websocketConnectionRegistry: WebsocketConnectionRegistryService,
    private readonly authorizationService: AuthorizationService,
    private readonly dtoMapper: DtoMapperService,
  ) {
    this.startMonitoring();
  }

  private mapNotificationToDto(notification: Notification): SystemNotificationDto {
    return this.dtoMapper.serialize(SystemNotificationDto, notification);
  }

  private startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      try {
        this.updateMetrics();
        this.checkThresholds();
        this.logMetrics();
      } catch (error) {
        this.logger.error('Erro no monitoramento do gateway (nao critico):', error);
      }
    }, 60000);
    this.monitoringInterval.unref?.();
  }

  private updateMetrics() {
    try {
      const currentActive = this.connectedClients.size;
      this.connectionMetrics.activeConnections = currentActive;
      this.connectionMetrics.peakConnections = Math.max(
        this.connectionMetrics.peakConnections,
        currentActive,
      );

      if (this.connectionMetrics.connectionAttempts > 0) {
        this.connectionMetrics.connectionFailureRate =
          (this.connectionMetrics.failedConnections / this.connectionMetrics.connectionAttempts) *
          100;
      }
    } catch (error) {
      this.logger.error('Erro ao atualizar metricas:', error);
    }
  }

  private checkThresholds() {
    try {
      const maxConnections = parseInt(process.env.MAX_WEBSOCKET_CONNECTIONS || '', 10) || 1000;

      if (this.connectionMetrics.activeConnections > maxConnections * 0.8) {
        this.logger.warn('ALTO_USO_CONEXOES', {
          active: this.connectionMetrics.activeConnections,
          threshold: maxConnections * 0.8,
          percentage: (
            (this.connectionMetrics.activeConnections / maxConnections) *
            100
          ).toFixed(2),
        });
      }

      if (this.connectionMetrics.connectionFailureRate > 5) {
        this.logger.warn('ALTA_TAXA_FALHAS_CONEXAO', {
          connectionFailureRate: this.connectionMetrics.connectionFailureRate,
          failedConnections: this.connectionMetrics.failedConnections,
          connectionAttempts: this.connectionMetrics.connectionAttempts,
        });
      }
    } catch (error) {
      this.logger.error('Erro ao verificar thresholds (nao critico):', error);
    }
  }

  private logMetrics() {
    try {
      this.logger.log('METRICAS_CONEXOES', {
        ...this.connectionMetrics,
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      });
    } catch (error) {
      this.logger.error('Erro ao logar metricas:', error);
    }
  }

  onModuleDestroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      this.connectionMetrics.totalConnections++;
      this.connectionMetrics.connectionAttempts++;

      if (!(await this.websocketRuntimeToggleService.isEnabledCached())) {
        this.logger.warn(
          `Canal de notificacoes websocket desabilitado; conexao rejeitada: ${client.id}`,
        );
        this.connectionMetrics.failedConnections++;
        this.disconnectClient(
          client,
          'WEBSOCKET_DISABLED',
          'Canal websocket desabilitado pela configuracao.',
        );
        return;
      }

      this.connectionStartTimes.set(client.id, Date.now());
      this.logger.log(
        `Cliente websocket conectando: ${client.id} ${JSON.stringify(
          sanitizeSensitiveData({
            hasAuthPayload: Boolean(client.handshake?.auth),
            hasAuthorizationHeader: Boolean(client.handshake?.headers?.authorization),
            hasCookieHeader: Boolean(client.handshake?.headers?.cookie),
            address: client.handshake?.address,
          }),
        )}`,
      );

      const token = this.extractTokenFromHandshake(client);
      if (!token) {
        this.logger.warn(`Cliente rejeitado - nenhum token fornecido: ${client.id}`);
        this.connectionMetrics.failedConnections++;
        this.disconnectClient(client, 'AUTH_TOKEN_MISSING', 'Token de autenticacao ausente.');
        return;
      }

      const user = await this.validateAndBindClient(client, token);
      if (!user) {
        this.connectionMetrics.failedConnections++;
        return;
      }

      this.connectedClients.set(client.id, client);
      this.websocketConnectionRegistry.register({
        clientId: client.id,
        userId: user.id,
        tenantId: user.tenantId,
        sessionId: user.sessionId,
        disconnect: (close?: boolean) => client.disconnect(close),
        emit: (event: string, payload: unknown) => client.emit(event, payload),
      });

      await this.joinRooms(client);

      this.logger.log(
        `Cliente conectado: ${client.id} (user: ${user.id}, tenant: ${user.tenantId ?? 'global'})`,
      );

      const unreadCount = await this.requestSecurityContext.runWithActor(user, () =>
        this.notificationService.countUnread(user),
      );
      client.emit('notification:unread-count', { count: unreadCount });
    } catch (error) {
      this.logger.error(`Erro na conexao do cliente ${client.id}:`, error);
      this.connectionMetrics.failedConnections++;
      this.disconnectClient(client, 'WEBSOCKET_CONNECTION_FAILED');
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const startTime = this.connectionStartTimes.get(client.id);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.connectionMetrics.avgConnectionDuration =
        ((this.connectionMetrics.avgConnectionDuration *
          (this.connectionMetrics.totalConnections - 1)) +
          duration) /
        this.connectionMetrics.totalConnections;

      this.connectionStartTimes.delete(client.id);
    }

    this.connectedClients.delete(client.id);
    this.websocketConnectionRegistry.unregister(client.id);
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('notification:mark-read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    try {
      const user = await this.requireValidatedSocket(client);
      if (!user) {
        return;
      }

      const notification = await this.requestSecurityContext.runWithActor(user, () =>
        this.notificationService.markUserNotificationAsRead(data.id, user),
      );

      if (notification) {
        client.emit('notification:read', this.mapNotificationToDto(notification));

        const unreadCount = await this.requestSecurityContext.runWithActor(user, () =>
          this.notificationService.countUnread(user),
        );
        client.emit('notification:unread-count', { count: unreadCount });

        this.logger.log(`Notificacao marcada como lida via Socket.IO: ${data.id}`);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao marcar notificacao como lida: ${data.id}`, {
        error: error?.message,
        stack: error?.stack,
        clientId: client.id,
        userId: client.user?.id,
        timestamp: new Date().toISOString(),
      });
      client.emit('notification:error', {
        message: 'Nao foi possivel processar a solicitacao',
        code: 'MARK_READ_FAILED',
      });
    }
  }

  @SubscribeMessage('notification:mark-all-read')
  async handleMarkAllAsRead(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const user = await this.requireValidatedSocket(client);
      if (!user) {
        return;
      }

      const count = await this.requestSecurityContext.runWithActor(user, () =>
        this.notificationService.markAllAsRead(user),
      );

      client.emit('notification:all-read', { count });
      client.emit('notification:unread-count', { count: 0 });

      this.logger.log(`${count} notificacoes marcadas como lidas via Socket.IO`);
    } catch (error: any) {
      this.logger.error('Erro ao marcar todas como lidas:', {
        error: error?.message,
        stack: error?.stack,
        clientId: client.id,
        userId: client.user?.id,
        timestamp: new Date().toISOString(),
      });
      client.emit('notification:error', {
        message: 'Nao foi possivel processar a solicitacao',
        code: 'MARK_ALL_READ_FAILED',
      });
    }
  }

  @SubscribeMessage('notification:delete')
  async handleDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    try {
      const user = await this.requireValidatedSocket(client);
      if (!user) {
        return;
      }

      const notification = await this.requestSecurityContext.runWithActor(user, () =>
        this.notificationService.delete(data.id, user),
      );

      if (notification) {
        client.emit('notification:deleted', { id: data.id });

        if (!notification.read) {
          const unreadCount = await this.requestSecurityContext.runWithActor(user, () =>
            this.notificationService.countUnread(user),
          );
          client.emit('notification:unread-count', { count: unreadCount });
        }

        this.logger.log(`Notificacao deletada via Socket.IO: ${data.id}`);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao deletar notificacao: ${data.id}`, {
        error: error?.message,
        stack: error?.stack,
        clientId: client.id,
        userId: client.user?.id,
        timestamp: new Date().toISOString(),
      });
      client.emit('notification:error', {
        message: 'Nao foi possivel processar a solicitacao',
        code: 'DELETE_NOTIFICATION_FAILED',
      });
    }
  }

  async emitNewNotification(
    notification: Notification,
    options: EmitNotificationOptions = {},
  ) {
    try {
      if (!(await this.ensureRealtimeChannelEnabled())) {
        await this.sendPushIfEnabled(notification, options);
        return;
      }

      const rooms = this.determineTargetRooms(notification);
      for (const room of rooms) {
        try {
          this.server.to(room).emit('notification:new', this.mapNotificationToDto(notification));
          this.logger.log(`Nova notificacao emitida para sala: ${room}`);
        } catch (roomError) {
          this.logger.error(`Erro ao emitir para sala ${room}:`, roomError);
        }
      }

      try {
        await this.updateUnreadCounts(notification);
      } catch (countError) {
        this.logger.error('Erro ao atualizar contagens (nao critico):', countError);
      }

      await this.sendPushIfEnabled(notification, options);
    } catch (error) {
      this.logger.error('Erro ao emitir nova notificacao (nao critico):', error);
    }
  }

  async emitNotificationRead(notification: Notification) {
    try {
      if (!(await this.ensureRealtimeChannelEnabled())) {
        return;
      }

      for (const room of this.determineTargetRooms(notification)) {
        this.server.to(room).emit('notification:read', this.mapNotificationToDto(notification));
      }
    } catch (error) {
      this.logger.error('Erro ao emitir notificacao lida:', error);
    }
  }

  async emitNotificationDeleted(notificationId: string, notification: Notification) {
    try {
      if (!(await this.ensureRealtimeChannelEnabled())) {
        return;
      }

      for (const room of this.determineTargetRooms(notification)) {
        this.server.to(room).emit('notification:deleted', { id: notificationId });
      }
    } catch (error) {
      this.logger.error('Erro ao emitir notificacao deletada:', error);
    }
  }

  private async joinRooms(client: AuthenticatedSocket) {
    const user = client.user;
    if (!user) {
      return;
    }

    await client.join(this.buildUserRoom(user));

    // Apenas ADMINs de fato ou SUPER_ADMINs globais podem entrar na sala administrativa do tenant.
    // SUPER_ADMIN com tenantId (seed antigo) nao deve entrar para evitar vazamento.
    if (user.tenantId && user.role === 'ADMIN') {
      await client.join(this.buildTenantAdminRoom(user.tenantId));
    }

    if (user.role === 'SUPER_ADMIN' && !user.tenantId) {
      await client.join(this.buildGlobalAdminRoom());
    }

    this.logger.debug(`Cliente ${client.id} entrou nas salas apropriadas`);
  }

  private determineTargetRooms(notification: Notification): string[] {
    if (notification.userId) {
      return [
        this.buildUserRoom({
          id: notification.userId,
          tenantId: notification.tenantId ?? null,
        }),
      ];
    }

    if (notification.tenantId) {
      return [this.buildTenantAdminRoom(notification.tenantId)];
    }

    return [this.buildGlobalAdminRoom()];
  }

  private async updateUnreadCounts(notification: Notification) {
    try {
      const targetUsers = new Set(await this.getTargetUsers(notification));
      for (const client of this.connectedClients.values()) {
        if (!client.user || !targetUsers.has(client.user.id)) {
          continue;
        }

        const unreadCount = await this.requestSecurityContext.runWithActor(client.user, () =>
          this.notificationService.countUnread(client.user!),
        );
        client.emit('notification:unread-count', { count: unreadCount });
      }
    } catch (error) {
      this.logger.error('Erro ao atualizar contagens:', error);
    }
  }

  private async getTargetUsers(notification: Notification): Promise<string[]> {
    const candidates = await this.fetchCandidateUsers(notification);
    const authorizedIds: string[] = [];

    for (const user of candidates) {
      const canReceive = this.authorizationService.canReceiveNotification(user, notification);
      if (canReceive) {
        authorizedIds.push(user.id);
      }
    }

    return authorizedIds;
  }

  private async fetchCandidateUsers(notification: Notification): Promise<any[]> {
    if (notification.userId) {
      const user = await this.prismaService.user.findUnique({
        where: { id: notification.userId },
        select: { id: true, role: true, tenantId: true },
      });
      return user ? [user] : [];
    }

    if (notification.tenantId) {
      return this.requestSecurityContext.runWithoutTenantEnforcement(
        'notification-gateway:get-tenant-target-users',
        () =>
          this.prismaService.user.findMany({
            where: {
              tenantId: notification.tenantId!,
              role: { in: ['ADMIN', 'SUPER_ADMIN'] },
            },
            select: { id: true, role: true, tenantId: true },
          }),
      );
    }

    return this.requestSecurityContext.runWithoutTenantEnforcement(
      'notification-gateway:get-global-target-users',
      () =>
        this.prismaService.user.findMany({
          where: { role: 'SUPER_ADMIN' },
          select: { id: true, role: true, tenantId: true },
        }),
    );
  }

  private extractTokenFromHandshake(client: AuthenticatedSocket): string | null {
    return (
      client.handshake?.auth?.token ||
      this.extractAccessTokenFromAuthorizationHeader(client.handshake?.headers?.authorization) ||
      this.extractAccessTokenFromCookieHeader(client.handshake?.headers?.cookie) ||
      null
    );
  }

  private extractAccessTokenFromAuthorizationHeader(
    authorizationHeader?: string | string[],
  ): string | null {
    const rawHeader = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;

    if (typeof rawHeader !== 'string' || !rawHeader.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    const token = rawHeader.slice(7).trim();
    return token.length > 0 ? token : null;
  }

  private extractAccessTokenFromCookieHeader(cookieHeader?: string | string[]): string | null {
    const rawHeader = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
    if (typeof rawHeader !== 'string' || rawHeader.trim().length === 0) {
      return null;
    }

    const cookies = rawHeader.split(';');
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name === ACCESS_TOKEN_COOKIE_NAME) {
        const value = valueParts.join('=').trim();
        return value.length > 0 ? decodeURIComponent(value) : null;
      }
    }

    return null;
  }

  private async validateAndBindClient(
    client: AuthenticatedSocket,
    token: string,
    expectedUserId?: string,
  ): Promise<AuthenticatedSessionActor | null> {
    try {
      const user = await this.authValidationService.validateAccessToken(token, {
        expectedUserId,
        expectedTenantId: client.user?.tenantId,
        ipAddress: client.handshake?.address,
        userAgent: this.resolveClientUserAgent(client),
        source: 'websocket',
      });

      client.user = user;
      client.accessToken = token;
      return user;
    } catch (error) {
      this.logger.warn(
        `Falha na autenticacao websocket client=${client.id} detalhe=${error instanceof Error ? error.message : String(error)}`,
      );
      this.disconnectClient(client, 'SESSION_REVOKED', 'Sessao invalida ou revogada.');
      return null;
    }
  }

  private async requireValidatedSocket(
    client: AuthenticatedSocket,
  ): Promise<AuthenticatedSessionActor | null> {
    if (!(await this.ensureRealtimeChannelEnabled(client))) {
      return null;
    }

    const token = client.accessToken || this.extractTokenFromHandshake(client);
    if (!token) {
      this.disconnectClient(client, 'AUTH_TOKEN_MISSING', 'Token de autenticacao ausente.');
      return null;
    }

    return this.validateAndBindClient(client, token, client.user?.id);
  }

  private async ensureRealtimeChannelEnabled(client?: AuthenticatedSocket): Promise<boolean> {
    const websocketEnabled = await this.websocketRuntimeToggleService.isEnabledCached();
    if (websocketEnabled) {
      return true;
    }

    if (client) {
      this.disconnectClient(
        client,
        'WEBSOCKET_DISABLED',
        'Canal websocket desabilitado pela configuracao.',
      );
      return false;
    }

    this.disconnectAllClientsBecauseChannelIsDisabled();
    return false;
  }

  private disconnectAllClientsBecauseChannelIsDisabled(): void {
    for (const client of this.connectedClients.values()) {
      this.disconnectClient(
        client,
        'WEBSOCKET_DISABLED',
        'Canal websocket desabilitado pela configuracao.',
      );
    }

    this.connectedClients.clear();
    this.connectionStartTimes.clear();
  }

  private async sendPushIfEnabled(
    notification: Notification,
    options: EmitNotificationOptions,
  ): Promise<void> {
    if (options.push === false) {
      return;
    }

    try {
      await this.pushNotificationService.sendNotification(notification);
    } catch (pushError) {
      this.logger.error('Erro ao enviar push (nao critico):', pushError);
    }
  }

  private buildUserRoom(user: { id: string; tenantId?: string | null }): string {
    return user.tenantId
      ? `tenant:${user.tenantId}:user:${user.id}`
      : `global:user:${user.id}`;
  }

  private buildTenantAdminRoom(tenantId: string): string {
    return `tenant:${tenantId}:admins`;
  }

  private buildGlobalAdminRoom(): string {
    return 'global:super-admins';
  }

  private disconnectClient(
    client: AuthenticatedSocket,
    code: string,
    message = 'Conexao websocket encerrada por politica de seguranca.',
  ): void {
    try {
      client.emit?.('notification:error', {
        message,
        code,
      });
    } catch {
      // Melhor esforco: nao impedir a desconexao.
    }

    this.connectedClients.delete(client.id);
    this.connectionStartTimes.delete(client.id);
    this.websocketConnectionRegistry.unregister(client.id);

    try {
      client.disconnect(true);
    } catch (error) {
      this.logger.warn(
        `Falha ao desconectar cliente websocket ${client.id}. detalhe=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private resolveClientUserAgent(client: AuthenticatedSocket): string | undefined {
    const header = client.handshake?.headers?.['user-agent'];
    const userAgent = Array.isArray(header) ? header[0] : header;
    return typeof userAgent === 'string' && userAgent.trim().length > 0
      ? userAgent.trim()
      : undefined;
  }
}
