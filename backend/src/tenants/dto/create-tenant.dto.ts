import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'CNPJ/CPF é obrigatório' })
  @MinLength(11, { message: 'CNPJ/CPF deve ter no mínimo 11 caracteres' })
  cnpjCpf: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome fantasia é obrigatório' })
  @MinLength(3, { message: 'Nome fantasia deve ter no mínimo 3 caracteres' })
  nomeFantasia: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome do responsável é obrigatório' })
  @MinLength(3, { message: 'Nome do responsável deve ter no mínimo 3 caracteres' })
  nomeResponsavel: string;

  @IsString()
  @IsNotEmpty({ message: 'Telefone é obrigatório' })
  @Matches(/^[\d\s\(\)\-\+]+$/, { message: 'Telefone inválido' })
  telefone: string;
}
