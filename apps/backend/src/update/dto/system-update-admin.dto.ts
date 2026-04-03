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
  @IsInt()
  @Min(1)
  @Max(2000)
  tail?: number;
}
