import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ChangeAdminPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  newPassword: string;
}
