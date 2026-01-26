import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '@core/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const expiresIn = configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
        
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            // Garantir que o expiresIn seja compatível com a tipagem do NestJS 11 (number | StringValue)
            expiresIn: /^\d+$/.test(expiresIn) ? Number(expiresIn) : (expiresIn as StringValue),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationsModule {}