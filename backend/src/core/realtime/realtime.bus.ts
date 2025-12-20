import { Injectable } from '@nestjs/common';
import { RealtimeMessage, RealtimeTransport } from './realtime.types';

@Injectable()
export class RealtimeBus {
    private transports: RealtimeTransport[] = [];

    registerTransport(transport: RealtimeTransport) {
        this.transports.push(transport);
    }

    publish(message: RealtimeMessage) {
        this.transports.forEach(t => t.emit(message));
    }
}
