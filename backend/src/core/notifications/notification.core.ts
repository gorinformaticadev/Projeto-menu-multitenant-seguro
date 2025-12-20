import { Injectable } from '@nestjs/common';
import { NotificationBus } from './notification.bus';
import { NotificationPayload } from './notification.types';

@Injectable()
export class NotificationCore {
    constructor(private bus: NotificationBus) { }

    // 📦 CONTRATO ÚNICO DE NOTIFICAÇÃO
    notify(payload: NotificationPayload) {
        this.bus.emit(payload);
    }
}
