import { IsEmail, IsString, IsNotEmpty, IsEnum, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { Role } from '@prisma/client';
import { IsStrongPassword } from '../../common/validators/password.validator';
import { Trim, ToLowerCase, NormalizeSpaces } from '../../common/decorators/sanitize.decorator';

export class CreateUserDto {
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  @MaxLength(254, { message: 'Email deve ter no máximo 254 caracteres' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @IsStrongPassword()
  password: string;

  @Trim()
  @NormalizeSpaces()
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  @Matches(/^[a-zA-ZÀ-ÿ\s]+$/, { message: 'Nome deve conter apenas letras e espaços' })
  name: string;

  @IsEnum(Role, { message: 'Role inválida' })
  @IsOptional()
  role?: Role;

  @Trim()
  @IsString()
  @IsOptional()
  @Matches(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, {
    message: 'TenantId deve ser um UUID válido'
  })
  tenantId?: string;
}
