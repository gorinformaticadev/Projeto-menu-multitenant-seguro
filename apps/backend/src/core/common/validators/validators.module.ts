import { Module } from '@nestjs/common';
import { IsStrongPasswordConstraint } from './password.validator';
import { SecurityConfigModule } from '@core/security-config/security-config.module';

@Module({
  imports: [SecurityConfigModule],
  providers: [IsStrongPasswordConstraint],
  exports: [IsStrongPasswordConstraint],
})
export class ValidatorsModule {
  // Empty implementation
}
