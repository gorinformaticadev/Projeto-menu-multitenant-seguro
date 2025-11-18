import { IsString, IsNotEmpty } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Senha atual é obrigatória' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'Nova senha é obrigatória' })
  @IsStrongPassword()
  newPassword: string;
}
