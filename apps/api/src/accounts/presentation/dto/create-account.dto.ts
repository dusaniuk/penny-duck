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

  @IsString({ message: "Currency is required" })
  @MinLength(3, { message: "Currency is required" })
  @MaxLength(3, { message: "Currency code must be 3 characters" })
  declare currency: string

  @IsOptional()
  @IsNumber()
  declare balance?: number
}
