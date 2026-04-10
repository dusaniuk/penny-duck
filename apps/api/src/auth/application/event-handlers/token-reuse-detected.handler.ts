import { EventsHandler, IEventHandler } from "@nestjs/cqrs"
import { Logger } from "@nestjs/common"
import { TokenReuseDetectedEvent } from "../../domain/events/token-reuse-detected.event"
import { RefreshTokenRepository } from "../../infrastructure/repositories/refresh-token.repository"

@EventsHandler(TokenReuseDetectedEvent)
export class TokenReuseDetectedHandler implements IEventHandler<TokenReuseDetectedEvent> {
  private readonly logger = new Logger(TokenReuseDetectedHandler.name)

  constructor(private readonly tokenRepo: RefreshTokenRepository) {}

  async handle(event: TokenReuseDetectedEvent): Promise<void> {
    this.logger.warn(
      `Token reuse detected for user ${event.userId}, family ${event.familyId}. Revoking ALL sessions for user.`
    )

    await this.tokenRepo.revokeAllByUserId(event.userId)

    // TODO: Send email notification to user about potential account compromise

    this.logger.warn(
      `All refresh tokens revoked for user ${event.userId} due to token reuse.`
    )
  }
}
