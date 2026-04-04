import { IsEmail, IsString, MaxLength, MinLength } from "class-validator"

export class SignupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  declare name: string

  @IsEmail()
  declare email: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  declare password: string
}
