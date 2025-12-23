export class CreateSistemaDto {
  name: string;
  description?: string;
}

export class UpdateSistemaDto {
  name?: string;
  description?: string;
}

export class FilterSistemaDto {
  limit?: number;
  offset?: number;
}