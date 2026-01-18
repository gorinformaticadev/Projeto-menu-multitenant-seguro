 import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Trim, ToLowerCase } from '@core/common/decorators/sanitize.decorator';

export class LoginDto {
  @Trim()
  @ToLowerCase()
  @IsEmail({
      // Empty implementation
    }, { message: 'Email invÃ¡lido' })
  @IsNotEmpty({ message: 'Email Ã© obrigatÃ³rio' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha Ã© obrigatÃ³ria' })
  @MinLength(6, { message: 'Senha deve ter no mÃ­nimo 6 caracteres' })
  password: string;
}

