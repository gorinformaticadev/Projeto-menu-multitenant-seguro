import { Injectable } from '@nestjs/common';
import { RealtimeBus } from '../realtime/realtime.bus';
import { NotificationStore } from './notification.store';
import { NotificationPayload } from './notification.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationBus {
    constructor(
        private realtimeBus: RealtimeBus,
        private store: NotificationStore
    ) { }

    async emit(payload: NotificationPayload) {
        if (!payload.id) {
            payload.id = uuidv4();
        }
        // 1. Emit Realtime (Immediate)
        // ⚡ FLUXO CORRETO: SSE emite IMEDIATAMENTE
        this.realtimeBus.publish({
            tenantId: payload.tenantId,
            userId: payload.userId || null,
            event: 'notification',
            data: payload,
        });

        // 2. Persist (Async, non-blocking)
        this.saveInBackground(payload);
    }

    private async saveInBackground(payload: NotificationPayload) {
        // 🧪 Simulação de atraso para prova de conceito
        if (process.env.SIMULATE_NOTIFICATION_DELAY === 'true') {
            console.log('Simulating DB Delay (25s)...');
            await new Promise(r => setTimeout(r, 25000));
        }
        await this.store.save(payload);
    }
}
