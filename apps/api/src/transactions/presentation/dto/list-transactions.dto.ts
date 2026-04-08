import { Transform, Type } from "class-transformer"
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator"

export class ListTransactionsDto {
  @IsOptional()
  @IsUUID()
  declare accountId?: string

  @IsOptional()
  @IsIn(["expense", "income", "transfer"])
  declare type?: string

  @IsOptional()
  @IsUUID()
  declare categoryId?: string

  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  declare settled?: boolean

  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  declare orphaned?: boolean

  @IsOptional()
  @IsDateString()
  declare dateFrom?: string

  @IsOptional()
  @IsDateString()
  declare dateTo?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  declare page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  declare limit?: number
}
