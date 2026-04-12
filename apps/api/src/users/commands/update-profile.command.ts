import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { isValidCurrencyCode } from "@workspace/shared/currencies"
import { UserRepository } from "../user.repository"
import type { CurrentUserResult } from "../queries/get-current-user.query"

export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly name?: string,
    public readonly homeCurrency?: string
  ) {}
}

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler
  implements ICommandHandler<UpdateProfileCommand>
{
  constructor(private readonly userRepo: UserRepository) {}

  async execute(command: UpdateProfileCommand): Promise<CurrentUserResult> {
    if (command.homeCurrency && !isValidCurrencyCode(command.homeCurrency)) {
      throw new BadRequestException("Invalid currency code")
    }
    const user = await this.userRepo.updateProfile(command.userId, {
      name: command.name,
      homeCurrency: command.homeCurrency,
    })
    if (!user) throw new NotFoundException("User not found")
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      homeCurrency: user.homeCurrency,
    }
  }
}
