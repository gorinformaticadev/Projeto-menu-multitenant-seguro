import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { SecurityConfigService } from '@core/security-config/security-config.service';
import { validatePasswordAgainstPolicy } from '@common/utils/password-policy.util';

@ValidatorConstraint({ name: 'IsStrongPassword', async: true })
@Injectable()
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  constructor(private securityConfigService: SecurityConfigService) {}

  async validate(password: string, _args: ValidationArguments): Promise<boolean> {
    if (!password) return false;

    const policy = await this.securityConfigService.getPasswordPolicy();
    return validatePasswordAgainstPolicy(password, policy).length === 0;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'A senha nao atende aos requisitos de seguranca configurados';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
