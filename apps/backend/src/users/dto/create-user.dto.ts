import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { IsStrongPassword } from '@core/common/validators/password.validator';
import { NormalizeSpaces, ToLowerCase, Trim } from '@core/common/decorators/sanitize.decorator';

export class CreateUserDto {
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email invalido' })
  @IsNotEmpty({ message: 'Email e obrigatorio' })
  @MaxLength(254, { message: 'Email deve ter no maximo 254 caracteres' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha e obrigatoria' })
  @IsStrongPassword()
  password: string;

  @Trim()
  @NormalizeSpaces()
  @IsString()
  @IsNotEmpty({ message: 'Nome e obrigatorio' })
  @MinLength(2, { message: 'Nome deve ter no minimo 2 caracteres' })
  @MaxLength(100, { message: 'Nome deve ter no maximo 100 caracteres' })
  @Matches(/^[a-zA-Z\u00C0-\u00FF\s]+$/, { message: 'Nome deve conter apenas letras e espacos' })
  name: string;

  @IsEnum(Role, { message: 'Role invalida' })
  @IsOptional()
  role?: Role;

  @Trim()
  @IsString()
  @IsOptional()
  @Matches(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, {
    message: 'TenantId deve ser um UUID valido',
  })
  tenantId?: string;
}
