import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Trim, ToLowerCase } from '../../common/decorators/sanitize.decorator';

export class LoginDto {
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string;
}
