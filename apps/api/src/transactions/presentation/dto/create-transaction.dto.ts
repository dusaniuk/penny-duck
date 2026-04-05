import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator"

export class CreateTransactionDto {
  @IsUUID()
  declare accountId: string

  @IsIn(["expense", "income"])
  declare type: string

  @IsNumber()
  @Min(0.01)
  declare amount: number

  @IsUUID()
  declare categoryId: string

  @IsDateString()
  declare date: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare note?: string

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  declare myShare?: number

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
