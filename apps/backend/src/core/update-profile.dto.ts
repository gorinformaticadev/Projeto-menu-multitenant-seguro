 import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Trim, ToLowerCase } from '@core/common/decorators/sanitize.decorator';

export class UpdateProfileDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Trim()
  @ToLowerCase()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

