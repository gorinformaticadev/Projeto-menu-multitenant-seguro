import { IsEmail, IsString, IsNotEmpty, Length } from 'class-validator';
import { Trim, ToLowerCase } from '../../common/decorators/sanitize.decorator';

export class Login2FADto {
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Código 2FA é obrigatório' })
  @Length(6, 6, { message: 'Código deve ter 6 dígitos' })
  twoFactorToken: string;
}
