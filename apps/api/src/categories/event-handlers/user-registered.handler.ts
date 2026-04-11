import { CommandBus, EventsHandler, IEventHandler } from "@nestjs/cqrs"
import { UserRegisteredEvent } from "../../auth/domain/events/user-registered.event"
import { SeedDefaultCategoriesCommand } from "../commands/seed-default-categories.command"

@EventsHandler(UserRegisteredEvent)
export class UserRegisteredHandler implements IEventHandler<UserRegisteredEvent> {
  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: UserRegisteredEvent): Promise<void> {
    await this.commandBus.execute(
      new SeedDefaultCategoriesCommand(event.organizationId)
    )
  }
}
