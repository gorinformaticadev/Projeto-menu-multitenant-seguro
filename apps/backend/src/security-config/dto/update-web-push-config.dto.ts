import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateWebPushConfigDto {
  @IsOptional()
  @IsString()
  webPushPublicKey?: string;

  @IsOptional()
  @IsString()
  webPushPrivateKey?: string;

  @IsOptional()
  @IsString()
  webPushSubject?: string;

  @IsOptional()
  @IsBoolean()
  clearPrivateKey?: boolean;
}
