import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator"

export class UpdateTransactionDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  declare amount?: number

  @IsOptional()
  @IsUUID()
  declare categoryId?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare note?: string | null

  @IsOptional()
  @IsDateString()
  declare date?: string

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  declare myShare?: number | null

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
