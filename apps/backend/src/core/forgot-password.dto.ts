import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({
      // Empty implementation
    }, { message: 'Email deve ter um formato válido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;
}