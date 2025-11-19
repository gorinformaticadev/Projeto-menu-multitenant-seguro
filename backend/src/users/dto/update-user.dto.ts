import { IsEmail, IsString, IsOptional, MinLength, IsEnum, IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';
import { IsStrongPassword } from '../../common/validators/password.validator';

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
  @IsStrongPassword()
  password?: string;
}

export class ToggleUserStatusDto {
  @IsBoolean()
  ativo: boolean;
}
