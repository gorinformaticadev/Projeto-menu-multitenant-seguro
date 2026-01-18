 import { IsEmail, IsString, IsNotEmpty, Length } from 'class-validator';
import { Trim, ToLowerCase } from '@core/common/decorators/sanitize.decorator';

export class Login2FADto {
  @Trim()
  @ToLowerCase()
  @IsEmail({
      // Empty implementation
    }, { message: 'Email invÃ¡lido' })
  @IsNotEmpty({ message: 'Email Ã© obrigatÃ³rio' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha Ã© obrigatÃ³ria' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'CÃ³digo 2FA Ã© obrigatÃ³rio' })
  @Length(6, 6, { message: 'CÃ³digo deve ter 6 dÃ­gitos' })
  twoFactorToken: string;
}

