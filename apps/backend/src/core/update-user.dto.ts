import { IsEmail, IsString, IsOptional, MinLength, IsEnum, IsBoolean, ValidateIf, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';

// Validador personalizado para senha baseado nas configuraÃ§Ãµes
function IsValidPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        async validate(value: any, args: ValidationArguments) {
          if (!value || typeof value !== 'string' || value.trim() === '') return true; // Se nÃ£o hÃ¡ senha, Ã© vÃ¡lido (para ediÃ§Ã£o)

          try {
            // Buscar configuraÃ§Ãµes de senha do banco
            const prisma = new PrismaService();
            const config = await prisma.securityConfig.findFirst();

            if (!config) {
              // Usar valores padrÃ£o se nÃ£o houver configuraÃ§Ã£o
              const minLength = 8;
              const requireUppercase = true;
              const requireLowercase = true;
              const requireNumbers = true;
              const requireSpecial = true;

              if (value.length < minLength) return false;
              if (requireUppercase && !/[A-Z]/.test(value)) return false;
              if (requireLowercase && !/[a-z]/.test(value)) return false;
              if (requireNumbers && !/\d/.test(value)) return false;
              if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) return false;

              return true;
            }

            // Validar baseado nas configuraÃ§Ãµes do banco
            if (value.length < config.passwordMinLength) return false;
            if (config.passwordRequireUppercase && !/[A-Z]/.test(value)) return false;
            if (config.passwordRequireLowercase && !/[a-z]/.test(value)) return false;
            if (config.passwordRequireNumbers && !/\d/.test(value)) return false;
            if (config.passwordRequireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) return false;

            return true;
          } catch (error) {
            // Em caso de erro, usar validaÃ§Ã£o bÃ¡sica
            return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
          }
        },
        defaultMessage(args: ValidationArguments) {
          return 'A senha nÃ£o atende aos requisitos de seguranÃ§a configurados';
        },
      },
    });
  };
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email invÃ¡lido' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nome deve ter no mÃ­nimo 3 caracteres' })
  name?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Role invÃ¡lida' })
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

