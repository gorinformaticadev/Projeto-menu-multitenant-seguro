import { Module } from '@nestjs/common';
import { SecurityConfigController } from './security-config.controller';
import { SecurityConfigService } from './security-config.service';
import { EmailConfigController } from './email-config.controller';
import { EmailConfigService } from './email-config.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [SecurityConfigController, EmailConfigController],
  providers: [SecurityConfigService, EmailConfigService],
  exports: [SecurityConfigService, EmailConfigService],
})
export class SecurityConfigModule {}
