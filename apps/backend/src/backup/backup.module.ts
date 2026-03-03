import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BackupController } from './backup.controller';
import { BackupCronService } from './backup-cron.service';
import { BackupService } from './backup.service';
import { SseJwtGuard } from './guards/sse-jwt.guard';
import { PrismaModule } from '../core/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

/**
 * Módulo responsável por funcionalidades de backup e restore
 */
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [BackupController],
  providers: [BackupService, BackupCronService, SseJwtGuard],
  exports: [BackupService],
})
export class BackupModule {}
