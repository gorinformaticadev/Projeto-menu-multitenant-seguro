import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private prisma: PrismaService) {}

  async validate(password: string, args: ValidationArguments): Promise<boolean> {
    if (!password) return false;

    // Buscar política de senha do banco
    const config = await this.prisma.securityConfig.findFirst();

    if (!config) {
      // Política padrão se não houver configuração
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
    // Tamanho mínimo
    if (password.length < policy.minLength) {
      return false;
    }

    // Letra maiúscula
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      return false;
    }

    // Letra minúscula
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      return false;
    }

    // Números
    if (policy.requireNumbers && !/\d/.test(password)) {
      return false;
    }

    // Caracteres especiais
    if (policy.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    // Mensagem padrão (a mensagem real será gerada de forma assíncrona)
    return 'A senha não atende aos requisitos de segurança configurados';
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
