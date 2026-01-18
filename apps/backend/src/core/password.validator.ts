 import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
}

@ValidatorConstraint({ name: 'IsStrongPassword', async: true })
@Injectable()
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  constructor(private prisma: PrismaService) {
      // Empty implementation
    }

  async validate(password: string, args: ValidationArguments): Promise<boolean> {
    if (!password) return false;

    // Buscar polÃ­tica de senha do banco
    const config = await this.prisma.securityConfig.findFirst();

    if (!config) {
      // PolÃ­tica padrÃ£o se nÃ£o houver configuraÃ§Ã£o
      return this.validatePassword(password, {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecial: true,
      });
    }

    return this.validatePassword(password, {
      minLength: config.passwordMinLength,
      requireUppercase: config.passwordRequireUppercase,
      requireLowercase: config.passwordRequireLowercase,
      requireNumbers: config.passwordRequireNumbers,
      requireSpecial: config.passwordRequireSpecial,
    });
  }

  private validatePassword(password: string, policy: PasswordPolicy): boolean {
    // Tamanho mÃ­nimo
    if (password.length < policy.minLength) {
      return false;
    }

    // Letra maiÃºscula
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      return false;
    }

    // Letra minÃºscula
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      return false;
    }

    // NÃºmeros
    if (policy.requireNumbers && !/\d/.test(password)) {
      return false;
    }

    // Caracteres especiais
    if (policy.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    // Mensagem padrÃ£o (a mensagem real serÃ¡ gerada de forma assÃ­ncrona)
    return 'A senha nÃ£o atende aos requisitos de seguranÃ§a configurados';
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

