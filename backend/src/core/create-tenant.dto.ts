import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { Trim, ToLowerCase, NormalizeSpaces } from '../../common/decorators/sanitize.decorator';
import { IsValidCPFOrCNPJ } from '../../common/validators/cpf-cnpj.validator';

export class CreateTenantDto {
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'CNPJ/CPF é obrigatório' })
  @IsValidCPFOrCNPJ({ message: 'CNPJ/CPF inválido' })
  cnpjCpf: string;

  @Trim()
  @NormalizeSpaces()
  @IsString()
  @IsNotEmpty({ message: 'Nome fantasia é obrigatório' })
  @MinLength(3, { message: 'Nome fantasia deve ter no mínimo 3 caracteres' })
  nomeFantasia: string;

  @Trim()
  @NormalizeSpaces()
  @IsString()
  @IsNotEmpty({ message: 'Nome do responsável é obrigatório' })
  @MinLength(3, { message: 'Nome do responsável deve ter no mínimo 3 caracteres' })
  nomeResponsavel: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Telefone é obrigatório' })
  @Matches(/^[\d\s\(\)\-\+]+$/, { message: 'Telefone inválido' })
  telefone: string;

  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email do administrador inválido' })
  @IsNotEmpty({ message: 'Email do administrador é obrigatório' })
  adminEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha do administrador é obrigatória' })
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  adminPassword: string;

  @Trim()
  @NormalizeSpaces()
  @IsString()
  @IsNotEmpty({ message: 'Nome do administrador é obrigatório' })
  @MinLength(3, { message: 'Nome do administrador deve ter no mínimo 3 caracteres' })
  adminName: string;
}
