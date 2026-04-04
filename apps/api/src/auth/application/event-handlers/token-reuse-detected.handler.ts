import { EventsHandler, IEventHandler } from "@nestjs/cqrs"
import { Logger } from "@nestjs/common"
import { TokenReuseDetectedEvent } from "../../domain/events/token-reuse-detected.event"

@EventsHandler(TokenReuseDetectedEvent)
export class TokenReuseDetectedHandler implements IEventHandler<TokenReuseDetectedEvent> {
  private readonly logger = new Logger(TokenReuseDetectedHandler.name)

  handle(event: TokenReuseDetectedEvent): void {
    this.logger.warn(
      `Token reuse detected for user ${event.userId}, family ${event.familyId}. All tokens in family revoked.`
    )
  }
}
