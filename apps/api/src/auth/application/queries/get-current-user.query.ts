import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { InvalidTokenError } from "../../domain/errors/auth.errors"
import { UserRepository } from "../../infrastructure/repositories/user.repository"

export class GetCurrentUserQuery {
  constructor(
    public readonly userId: string,
    public readonly email: string
  ) {}
}

export interface CurrentUserResult {
  id: string
  email: string
  name: string
  homeCurrency: string
}

@QueryHandler(GetCurrentUserQuery)
export class GetCurrentUserHandler implements IQueryHandler<GetCurrentUserQuery> {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(query: GetCurrentUserQuery): Promise<CurrentUserResult> {
    const user = await this.userRepo.findByEmail(query.email)
    if (!user) throw new InvalidTokenError()

    return { id: user.id, email: user.email, name: user.name, homeCurrency: user.homeCurrency }
  }
}
