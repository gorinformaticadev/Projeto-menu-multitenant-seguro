import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/prisma/prisma.module';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';
import { SecurityConfigController } from './security-config.controller';
import { SecurityConfigService } from './security-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [SecurityConfigController, PlatformConfigController],
  providers: [SecurityConfigService, PlatformConfigService],
  exports: [SecurityConfigService, PlatformConfigService],
})
export class SecurityConfigModule {}
