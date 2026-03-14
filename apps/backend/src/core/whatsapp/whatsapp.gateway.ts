/**
 * WHATSAPP GATEWAY - Socket.IO Gateway (preparacao futura)
 *
 * Gateway preparado para comunicacao WhatsApp via Socket.IO
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebsocketRuntimeToggleService } from '@common/services/websocket-runtime-toggle.service';

@WebSocketGateway({
  namespace: '/whatsapp',
  cors: {
    origin: '*',
  },
})
export class WhatsAppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhatsAppGateway.name);

  constructor(
    private readonly websocketRuntimeToggleService: WebsocketRuntimeToggleService,
  ) {}

  async handleConnection(client: Socket) {
    if (!(await this.websocketRuntimeToggleService.isEnabledCached())) {
      this.logger.warn(`WhatsApp websocket desabilitado; conexao rejeitada: ${client.id}`);
      client.disconnect(true);
      return;
    }

    this.logger.log(`WhatsApp client connected: ${client.id}`);
    // Implementacao futura
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WhatsApp client disconnected: ${client.id}`);
    // Implementacao futura
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(client: Socket, _payload: unknown) {
    if (!(await this.websocketRuntimeToggleService.isEnabledCached())) {
      this.logger.warn(`WhatsApp websocket desabilitado; mensagem ignorada para client ${client.id}`);
      client.disconnect(true);
      return { status: 'disabled_by_configuration' };
    }

    this.logger.log('WhatsApp message handling prepared');
    // Implementacao futura
    return { status: 'prepared' };
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(client: Socket, _payload: unknown) {
    if (!(await this.websocketRuntimeToggleService.isEnabledCached())) {
      this.logger.warn(`WhatsApp websocket desabilitado; room join ignorado para client ${client.id}`);
      client.disconnect(true);
      return { status: 'disabled_by_configuration' };
    }

    this.logger.log('WhatsApp room joining prepared');
    // Implementacao futura
    return { status: 'prepared' };
  }
}
