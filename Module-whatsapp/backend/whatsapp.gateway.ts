import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
// import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard'; // Exemplo de import do core (ajustar no deploy)

@Injectable()
@WebSocketGateway({
    namespace: 'whatsapp',
    cors: {
        origin: '*', // Ajustar para produção
    },
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WhatsappGateway.name);

    // Armazena a qual tenant cada socket pertence
    private socketTenantMap = new Map<string, string>();

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);

        // Aqui você extrairia o tenantId do token JWT ou handshake query
        // Por enquanto, vamos assumir que o frontend envia 'x-tenant-id' no handshake ou query
        const tenantId = client.handshake.query.tenantId as string;

        if (tenantId) {
            this.socketTenantMap.set(client.id, tenantId);
            client.join(tenantId); // Sala exclusiva do tenant
            this.logger.log(`Client ${client.id} joined tenant room: ${tenantId}`);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
        this.socketTenantMap.delete(client.id);
    }

    // Método auxiliar para enviar QR Code para a sala do tenant
    emitQrCode(tenantId: string, qrCode: string) {
        this.server.to(tenantId).emit('qr_code', qrCode);
    }

    // Método auxiliar para enviar status de conexão
    emitStatus(tenantId: string, status: string, data?: any) {
        this.server.to(tenantId).emit('connection_status', { status, ...data });
    }

    @SubscribeMessage('start_session')
    handleStartSession(@ConnectedSocket() client: Socket) {
        const tenantId = this.socketTenantMap.get(client.id);
        if (!tenantId) {
            client.emit('error', 'Tenant ID not identified');
            return;
        }

        this.logger.log(`Request to start session for tenant: ${tenantId}`);
        return { event: 'session_starting', data: { tenantId } };
    }
}
