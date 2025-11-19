import { IsEmail, IsString, IsOptional, MinLength, IsEnum, IsBoolean, ValidateIf, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Validador personalizado para senha baseado nas configurações
function IsValidPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        async validate(value: any, args: ValidationArguments) {
          if (!value || typeof value !== 'string' || value.trim() === '') return true; // Se não há senha, é válido (para edição)

          try {
            // Buscar configurações de senha do banco
            const prisma = new PrismaService();
            const config = await prisma.securityConfig.findFirst();

            if (!config) {
              // Usar valores padrão se não houver configuração
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

            // Validar baseado nas configurações do banco
            if (value.length < config.passwordMinLength) return false;
            if (config.passwordRequireUppercase && !/[A-Z]/.test(value)) return false;
            if (config.passwordRequireLowercase && !/[a-z]/.test(value)) return false;
            if (config.passwordRequireNumbers && !/\d/.test(value)) return false;
            if (config.passwordRequireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) return false;

            return true;
          } catch (error) {
            // Em caso de erro, usar validação básica
            return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
          }
        },
        defaultMessage(args: ValidationArguments) {
          return 'A senha não atende aos requisitos de segurança configurados';
        },
      },
    });
  };
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nome deve ter no mínimo 3 caracteres' })
  name?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Role inválida' })
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
