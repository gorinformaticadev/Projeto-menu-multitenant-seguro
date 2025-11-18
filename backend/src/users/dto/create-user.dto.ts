import { IsEmail, IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';
import { IsStrongPassword } from '../../common/validators/password.validator';
import { Trim, ToLowerCase, NormalizeSpaces } from '../../common/decorators/sanitize.decorator';

export class CreateUserDto {
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @IsStrongPassword()
  password: string;

  @Trim()
  @NormalizeSpaces()
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsEnum(Role, { message: 'Role inválida' })
  @IsOptional()
  role?: Role;

  @Trim()
  @IsString()
  @IsOptional()
  tenantId?: string;
}
