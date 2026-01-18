 import { Module } from '@nestjs/common';
import { IsStrongPasswordConstraint } from './password.validator';
import { 
  ValidTenantIdValidator, 
  ValidUuidFormatValidator, 
  ReasonablePayloadSizeValidator 
} from './security.validators';
import { PrismaModule } from '@core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
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

