import { IsString, IsNotEmpty, Length } from 'class-validator';

export class Verify2FADto {
  @IsString()
  @IsNotEmpty({ message: 'Código é obrigatório' })
  @Length(6, 6, { message: 'Código deve ter 6 dígitos' })
  token: string;
}
