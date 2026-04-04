import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  declare name?: string

  @IsOptional()
  @IsString()
  declare type?: string
}
