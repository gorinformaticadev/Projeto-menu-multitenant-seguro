import { IsString, MinLength } from 'class-validator';

/**
 * DTO para restauração de backup do banco de dados
 */
export class RestoreBackupDto {
  @IsString()
  @MinLength(9)
  confirmationText: string; // Deve ser "CONFIRMAR"
}
