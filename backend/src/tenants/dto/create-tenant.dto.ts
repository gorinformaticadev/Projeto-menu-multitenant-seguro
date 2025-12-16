import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { Trim, ToLowerCase, NormalizeSpaces } from '@core/common/decorators/sanitize.decorator';
import { IsValidCPFOrCNPJ } from '@core/common/validators/cpf-cnpj.validator';

export class CreateTenantDto {
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email invÃ¡lido' })
  @IsNotEmpty({ message: 'Email Ã© obrigatÃ³rio' })
  email: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'CNPJ/CPF Ã© obrigatÃ³rio' })
  @IsValidCPFOrCNPJ({ message: 'CNPJ/CPF invÃ¡lido' })
  cnpjCpf: string;

  @Trim()
  @NormalizeSpaces()
  @IsString()
  @IsNotEmpty({ message: 'Nome fantasia Ã© obrigatÃ³rio' })
  @MinLength(3, { message: 'Nome fantasia deve ter no mÃ­nimo 3 caracteres' })
  nomeFantasia: string;

  @Trim()
  @NormalizeSpaces()
  @IsString()
  @IsNotEmpty({ message: 'Nome do responsÃ¡vel Ã© obrigatÃ³rio' })
  @MinLength(3, { message: 'Nome do responsÃ¡vel deve ter no mÃ­nimo 3 caracteres' })
  nomeResponsavel: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Telefone Ã© obrigatÃ³rio' })
  @Matches(/^[\d\s\(\)\-\+]+$/, { message: 'Telefone invÃ¡lido' })
  telefone: string;

  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email do administrador invÃ¡lido' })
  @IsNotEmpty({ message: 'Email do administrador Ã© obrigatÃ³rio' })
  adminEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha do administrador Ã© obrigatÃ³ria' })
  @MinLength(6, { message: 'Senha deve ter no mÃ­nimo 6 caracteres' })
  adminPassword: string;

  @Trim()
  @NormalizeSpaces()
  @IsString()
  @IsNotEmpty({ message: 'Nome do administrador Ã© obrigatÃ³rio' })
  @MinLength(3, { message: 'Nome do administrador deve ter no mÃ­nimo 3 caracteres' })
  adminName: string;
}

