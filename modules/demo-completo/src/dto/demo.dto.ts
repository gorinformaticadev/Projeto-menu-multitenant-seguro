import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  Min,
  Max,
  IsArray,
} from "class-validator";

export enum DemoStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

/**
 * DTO para criação de demonstração
 */
export class CreateDemoDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(DemoStatus)
  @IsOptional()
  status?: DemoStatus = DemoStatus.DRAFT;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  priority?: number = 0;

  @IsArray()
  @IsOptional()
  categoryIds?: string[];

  @IsArray()
  @IsOptional()
  tagIds?: string[];
}

/**
 * DTO para atualização de demonstração
 */
export class UpdateDemoDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(DemoStatus)
  @IsOptional()
  status?: DemoStatus;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  priority?: number;

  @IsArray()
  @IsOptional()
  categoryIds?: string[];

  @IsArray()
  @IsOptional()
  tagIds?: string[];
}

/**
 * DTO para filtros de busca
 */
export class FilterDemoDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @IsEnum(DemoStatus)
  @IsOptional()
  status?: DemoStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  tagId?: string;

  @IsString()
  @IsOptional()
  sortBy?: string = "createdAt";

  @IsString()
  @IsOptional()
  sortOrder?: "asc" | "desc" = "desc";
}

/**
 * DTO para criar categoria
 */
export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsInt()
  @IsOptional()
  orderIndex?: number = 0;
}

/**
 * DTO para atualizar categoria
 */
export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsInt()
  @IsOptional()
  orderIndex?: number;
}

/**
 * DTO para criar tag
 */
export class CreateTagDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  color?: string;
}

/**
 * DTO para atualizar tag
 */
export class UpdateTagDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

/**
 * DTO para criar comentário
 */
export class CreateCommentDto {
  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}
