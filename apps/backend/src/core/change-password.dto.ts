import { IsString, IsNotEmpty } from 'class-validator';
import { IsStrongPassword } from '@core/common/validators/password.validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Senha atual Ã© obrigatÃ³ria' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'Nova senha Ã© obrigatÃ³ria' })
  @IsStrongPassword()
  newPassword: string;
}

