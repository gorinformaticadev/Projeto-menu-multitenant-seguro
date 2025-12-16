import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityConfigModule } from '../security-config/security-config.module';

@Module({
  imports: [PrismaModule, forwardRef(() => SecurityConfigModule)],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}