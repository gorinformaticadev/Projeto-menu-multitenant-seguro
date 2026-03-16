import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/prisma/prisma.module';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';
import { SecurityConfigController } from './security-config.controller';
import { SecurityConfigService } from './security-config.service';
import { SecurityRuntimeConfigService } from './security-runtime-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [SecurityConfigController, PlatformConfigController],
  providers: [SecurityConfigService, SecurityRuntimeConfigService, PlatformConfigService],
  exports: [SecurityConfigService, SecurityRuntimeConfigService, PlatformConfigService],
})
export class SecurityConfigModule {}
