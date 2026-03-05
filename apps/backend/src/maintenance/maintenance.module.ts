import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { TokenCleanupService } from '../common/services/token-cleanup.service';

@Module({
  imports: [PrismaModule],
  providers: [TokenCleanupService],
  exports: [TokenCleanupService],
})
export class MaintenanceModule {}
