import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io'; // Dependencies usually installed for NestJS Gateways

@WebSocketGateway({
    namespace: 'whatsapp',
    cors: {
        origin: '*', // Adjust for security in prod
    },
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    handleConnection(client: any) {
        // console.log('Whatsapp Client connected:', client.id);
    }

    handleDisconnect(client: any) {
        // console.log('Whatsapp Client disconnected:', client.id);
    }
}
