import { Module, OnModuleInit, Global } from '@nestjs/common';
import { NotificationCore } from './notification.core';
import { NotificationBus } from './notification.bus';
import { NotificationStore } from './notification.store';
import { NotificationPermissions } from './notification.permissions';
import { NotificationSseController, NotificationSseTransport } from './notification.sse';
import { NotificationController } from './notification.controller';
import { RealtimeBus } from '../realtime/realtime.bus';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationService } from '../notification.service';

@Global() // Make it global so other modules can use NotificationCore easily
@Module({
    imports: [PrismaModule],
    controllers: [NotificationSseController, NotificationController],
    providers: [
        RealtimeBus,
        NotificationCore,
        NotificationBus,
        NotificationStore,
        NotificationPermissions,
        NotificationSseTransport,
        NotificationService,
    ],
    exports: [NotificationCore, NotificationStore, NotificationService],
})
export class NotificationModule implements OnModuleInit {
    constructor(
        private realtimeBus: RealtimeBus,
        private sseTransport: NotificationSseTransport
    ) { }

    onModuleInit() {
        this.realtimeBus.registerTransport(this.sseTransport);
    }
}
