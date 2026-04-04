import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator"

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  declare name: string

  @IsString()
  declare type: string

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  declare currency: string

  @IsOptional()
  @IsNumber()
  declare balance?: number
}
