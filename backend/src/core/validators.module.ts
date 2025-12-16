import { Module } from '@nestjs/common';
import { IsStrongPasswordConstraint } from './password.validator';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IsStrongPasswordConstraint],
  exports: [IsStrongPasswordConstraint],
})
export class ValidatorsModule {}
