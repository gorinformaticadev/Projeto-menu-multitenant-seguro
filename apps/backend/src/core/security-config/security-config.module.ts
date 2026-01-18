 import { Module, forwardRef } from '@nestjs/common';
import { SecurityConfigController } from './security-config.controller';
import { SecurityConfigService } from './security-config.service';
import { EmailConfigController } from './email-config.controller';
import { EmailConfigService } from './email-config.service';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';
import { PrismaModule } from '@core/prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, forwardRef(() => EmailModule)],
  controllers: [SecurityConfigController, EmailConfigController, PlatformConfigController],
  providers: [SecurityConfigService, EmailConfigService, PlatformConfigService],
  exports: [SecurityConfigService, EmailConfigService, PlatformConfigService],
})
export class SecurityConfigModule {
      // Empty implementation
    }
