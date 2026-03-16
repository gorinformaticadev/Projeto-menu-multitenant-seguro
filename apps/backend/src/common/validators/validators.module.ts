import { Module } from '@nestjs/common';
import { Validator } from 'class-validator';
import { IsStrongPasswordConstraint } from './password.validator';
import {
  ValidTenantIdValidator,
  ValidUuidFormatValidator,
  ReasonablePayloadSizeValidator,
} from './security.validators';
import { PrismaModule } from '@core/prisma/prisma.module';
import { SecurityConfigModule } from '@core/security-config/security-config.module';

@Module({
  imports: [PrismaModule, SecurityConfigModule],
  providers: [
    // Necessario para compatibilidade com class-validator + useContainer no bootstrap.
    // Sem este provider, algumas execucoes em producao podem falhar com:
    // "Nest could not find Validator element".
    Validator,
    IsStrongPasswordConstraint,
    ValidTenantIdValidator,
    ValidUuidFormatValidator,
    ReasonablePayloadSizeValidator
  ],
  exports: [
    Validator,
    IsStrongPasswordConstraint,
    ValidTenantIdValidator,
    ValidUuidFormatValidator,
    ReasonablePayloadSizeValidator
  ],
})
export class ValidatorsModule {
  // Empty implementation
}
