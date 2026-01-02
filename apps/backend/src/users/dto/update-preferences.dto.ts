import { IsIn, IsString } from 'class-validator';

export class UpdatePreferencesDto {
    @IsString()
    @IsIn(['light', 'dark', 'system'])
    theme: string;
}
