import { IsIn, IsOptional, IsUUID } from "class-validator"

export class DeleteAccountDto {
  @IsIn(["move", "orphan", "delete"])
  declare mode: "move" | "orphan" | "delete"

  @IsOptional()
  @IsUUID()
  declare targetAccountId?: string
}
