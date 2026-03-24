import { Module } from '@nestjs/common';
import { EmailConfigService } from './email-config.service';
import { EmailConfigController } from './email-config.controller';
import { PrismaModule } from '@core/prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { SecurityConfigModule } from './security-config.module';

@Module({
  imports: [PrismaModule, EmailModule, SecurityConfigModule],
  controllers: [EmailConfigController],
  providers: [EmailConfigService],
  exports: [EmailConfigService],
})
export class EmailConfigModule {
      // Empty implementation
    }
