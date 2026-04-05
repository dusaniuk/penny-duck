import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator"

export class UpdateTransferDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  declare amount?: number

  @IsOptional()
  @IsDateString()
  declare date?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare note?: string | null

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  declare originalAmount?: number | null

  @IsOptional()
  @IsString()
  @MaxLength(3)
  declare originalCurrency?: string | null

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  declare exchangeRate?: number | null
}
