import { IsEnum, IsOptional } from 'class-validator';

export enum ThemeEnum {
    light = 'light',
    dark = 'dark',
    system = 'system',
}

export class UpdateUserPreferencesDto {
    @IsOptional()
    @IsEnum(ThemeEnum)
    theme?: ThemeEnum;
}
