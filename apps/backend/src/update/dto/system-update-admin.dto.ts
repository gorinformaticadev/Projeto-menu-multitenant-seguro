import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class RunSystemUpdateDto {}

export class RunSystemRollbackDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._+\-/]+$/, {
    message: 'target invalido',
  })
  target?: string;
}

export class SystemUpdateLogQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  })
  @IsInt()
  @Min(1)
  @Max(2000)
  tail?: number;
}
