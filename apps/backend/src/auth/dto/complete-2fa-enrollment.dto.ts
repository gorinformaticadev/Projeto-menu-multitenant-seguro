import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class Complete2FAEnrollmentDto {
  @IsString()
  @Length(6, 6, { message: 'Codigo deve ter 6 digitos' })
  token: string;

  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}
