import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';

function IsValidPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        async validate(value: unknown, _args: ValidationArguments) {
          if (!value || typeof value !== 'string' || value.trim() === '') {
            return true;
          }

          try {
            const prisma = new PrismaService();
            const config = await prisma.securityConfig.findFirst();

            if (!config) {
              return (
                value.length >= 8 &&
                /[A-Z]/.test(value) &&
                /[a-z]/.test(value) &&
                /\d/.test(value) &&
                /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)
              );
            }

            if (value.length < config.passwordMinLength) {
              return false;
            }
            if (config.passwordRequireUppercase && !/[A-Z]/.test(value)) {
              return false;
            }
            if (config.passwordRequireLowercase && !/[a-z]/.test(value)) {
              return false;
            }
            if (config.passwordRequireNumbers && !/\d/.test(value)) {
              return false;
            }
            if (config.passwordRequireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) {
              return false;
            }

            return true;
          } catch {
            return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
          }
        },
        defaultMessage(_args: ValidationArguments) {
          return 'A senha nao atende aos requisitos de seguranca configurados';
        },
      },
    });
  };
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email invalido' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nome deve ter no minimo 3 caracteres' })
  name?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Role invalida' })
  role?: Role;

  @IsOptional()
  @IsString()
  @IsValidPassword()
  password?: string;
}

export class ToggleUserStatusDto {
  @IsBoolean()
  ativo: boolean;
}
