 import { Module } from '@nestjs/common';
import { IsStrongPasswordConstraint } from './password.validator';
import { 
  ValidTenantIdValidator, 
  ValidUuidFormatValidator, 
  ReasonablePayloadSizeValidator 
} from './security.validators';
import { PrismaModule } from '@core/prisma/prisma.module';
import { SecurityConfigModule } from '@core/security-config/security-config.module';

@Module({
  imports: [PrismaModule, SecurityConfigModule],
  providers: [
    IsStrongPasswordConstraint,
    ValidTenantIdValidator,
    ValidUuidFormatValidator,
    ReasonablePayloadSizeValidator
  ],
  exports: [
    IsStrongPasswordConstraint,
    ValidTenantIdValidator,
    ValidUuidFormatValidator,
    ReasonablePayloadSizeValidator
  ],
})
export class ValidatorsModule {
      // Empty implementation
    }
