import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator"

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  declare name: string

  @IsOptional()
  @IsUUID()
  declare parentId?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare icon?: string
}
