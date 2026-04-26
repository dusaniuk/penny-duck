import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { InstrumentRepository } from "../instrument.repository"
import { InstrumentService } from "../instrument.service"

export class RefreshPricesCommand extends Command<{ refreshed: number }> {
  constructor(public readonly organizationId: string) {
    super()
  }
}

@CommandHandler(RefreshPricesCommand)
export class RefreshPricesHandler implements ICommandHandler<RefreshPricesCommand> {
  constructor(
    private readonly repo: InstrumentRepository,
    private readonly service: InstrumentService
  ) {}

  async execute(cmd: RefreshPricesCommand): Promise<{ refreshed: number }> {
    const referenced = await this.repo.findAllReferenced(cmd.organizationId)
    const { refreshed, stale } = await this.service.refreshIfStale(referenced)
    return { refreshed: stale ? 0 : refreshed.length }
  }
}
