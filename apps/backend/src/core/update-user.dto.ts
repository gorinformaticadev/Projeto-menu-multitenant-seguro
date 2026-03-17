import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { IsStrongPassword } from '@core/common/validators/password.validator';

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
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsStrongPassword()
  password?: string;
}

export class ToggleUserStatusDto {
  @IsBoolean()
  ativo: boolean;
}
