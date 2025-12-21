import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '@core/prisma/prisma.module';
import { NotificationModule } from '@core/notifications/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
