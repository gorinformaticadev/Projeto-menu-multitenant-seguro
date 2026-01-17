import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { WhatsappGateway } from './whatsapp.gateway';
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    WASocket
} from 'whaileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';
import * as pino from 'pino';

@Injectable()
export class WhatsappService {
    private sessions = new Map<string, WASocket>();
    private readonly logger = new Logger(WhatsappService.name);
    // Usa o diretório storage do Core
    private readonly sessionsDir = path.join(process.cwd(), 'storage', 'whatsapp_sessions');

    constructor(
        @Inject(forwardRef(() => WhatsappGateway))
        private readonly gateway: WhatsappGateway,
    ) {
        // Garante que o diretório base existe
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    async startSession(tenantId: string) {
        if (this.sessions.has(tenantId)) {
            this.logger.log(`Session already exists for tenant: ${tenantId}`);
            // Poderia verificar status e reenviar
            return;
        }

        this.logger.log(`Starting session for tenant: ${tenantId}`);

        const authPath = path.join(this.sessionsDir, tenantId);
        if (!fs.existsSync(authPath)) {
            fs.mkdirSync(authPath, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        const sock = makeWASocket({
            logger: pino({ level: 'error' }) as any,
            printQRInTerminal: false,
            auth: state,
            // browser: ['Multitenant CRM', 'Chrome', '1.0.0'],
        });

        this.sessions.set(tenantId, sock);

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                this.logger.log(`QR Code generated for tenant ${tenantId}`);
                // Emite o QR Code string diretamente para o frontend
                this.gateway.emitQrCode(tenantId, qr);
            }

            if (connection === 'close') {
                // cast para Boom para acessar output.statusCode
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

                this.logger.warn(`Connection closed for tenant ${tenantId}. Reconnecting: ${shouldReconnect}`);

                this.gateway.emitStatus(tenantId, 'disconnected');

                if (shouldReconnect) {
                    this.startSession(tenantId);
                } else {
                    this.logger.log(`Session logged out for tenant ${tenantId}`);
                    this.sessions.delete(tenantId);
                    // Aqui poderia apagar a pasta de auth se desejado
                }
            } else if (connection === 'open') {
                this.logger.log(`Connection opened for tenant ${tenantId}`);
                this.gateway.emitStatus(tenantId, 'connected', {
                    id: sock.user?.id,
                    name: sock.user?.name
                });
            }
        });

        // Exemplo de como lidar com mensagens recebidas
        sock.ev.on('messages.upsert', async (m) => {
            // if (m.type === 'notify') ...
            // Integrar com sistema de chat
        });
    }

    async getStatus(tenantId: string) {
        if (this.sessions.has(tenantId)) {
            return 'active';
        }
        return 'inactive';
    }

    async logout(tenantId: string) {
        const sock = this.sessions.get(tenantId);
        if (sock) {
            await sock.logout();
            this.sessions.delete(tenantId);
            this.gateway.emitStatus(tenantId, 'disconnected');
        }
    }
}
