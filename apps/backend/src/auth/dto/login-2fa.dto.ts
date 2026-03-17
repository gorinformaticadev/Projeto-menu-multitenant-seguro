import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { Trim, ToLowerCase } from '@core/common/decorators/sanitize.decorator';

export class Login2FADto {
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: 'Email invalido' })
  @IsNotEmpty({ message: 'Email e obrigatorio' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha e obrigatoria' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Codigo 2FA e obrigatorio' })
  @Length(6, 6, { message: 'Codigo deve ter 6 digitos' })
  twoFactorToken: string;

  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}
