import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator"

export class CreateTransferDto {
  @IsUUID()
  declare fromAccountId: string

  @IsUUID()
  declare toAccountId: string

  @IsNumber()
  @Min(0.01)
  declare amount: number

  @IsDateString()
  declare date: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare note?: string

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  declare originalAmount?: number

  @IsOptional()
  @IsString()
  @MaxLength(3)
  declare originalCurrency?: string

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  declare exchangeRate?: number
}
