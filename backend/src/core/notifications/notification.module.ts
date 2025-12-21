/**
 * NOTIFICATION MODULE - Módulo do sistema de notificações
 */

import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationController } from './notification.controller';
import { NotificationCore } from './notification.core';
import { NotificationBus } from './notification.bus';
import { NotificationSSE } from './notification.sse';
import { NotificationStore } from './notification.store';
import { NotificationPermissionsService } from './notification.permissions';
import { RealtimeModule } from '../realtime/realtime.module';
import { PrismaModule } from '@core/prisma/prisma.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    ScheduleModule.forRoot()
  ],
  controllers: [NotificationController],
  providers: [
    NotificationCore,
    NotificationBus,
    NotificationSSE,
    NotificationStore,
    NotificationPermissionsService
  ],
  exports: [
    NotificationCore,
    NotificationBus,
    NotificationSSE,
    NotificationStore,
    NotificationPermissionsService
  ],
})
export class NotificationModule {}