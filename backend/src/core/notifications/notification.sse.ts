import { Injectable, Controller, Sse, MessageEvent, UseGuards, Req } from '@nestjs/common';
import { Subject, Observable, filter, map } from 'rxjs';
import { RealtimeTransport, RealtimeMessage } from '../realtime/realtime.types';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Injectable()
export class NotificationSseTransport implements RealtimeTransport {
    private eventSubject = new Subject<RealtimeMessage>();

    emit(message: RealtimeMessage) {
        // 📌 Linha exata de emissão SSE
        this.eventSubject.next(message);
    }

    getStream(tenantId: string, userId: string): Observable<MessageEvent> {
        return this.eventSubject.asObservable().pipe(
            filter(msg => {
                if (msg.tenantId && msg.tenantId !== tenantId) return false;
                if (msg.userId && msg.userId !== userId) return false;
                return true;
            }),
            map(msg => ({
                data: msg.data
            } as MessageEvent))
        );
    }
}

@Controller('notifications/sse')
@UseGuards(JwtAuthGuard)
export class NotificationSseController {
    constructor(private readonly sseTransport: NotificationSseTransport) { }

    @Sse('stream')
    sse(@Req() req: any): Observable<MessageEvent> {
        const user = req.user;
        return this.sseTransport.getStream(user.tenantId, user.id);
    }
}
