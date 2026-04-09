import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { CategoryNotFoundError } from "../../errors/category.errors"
import { CategoryRepository } from "../../repositories/category.repository"

export class DeleteCategoryCommand extends Command<void> {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {
    super()
  }
}

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler
  implements ICommandHandler<DeleteCategoryCommand>
{
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(cmd: DeleteCategoryCommand): Promise<void> {
    const category = await this.categoryRepo.findById(cmd.id, cmd.userId)
    if (category === null) throw new CategoryNotFoundError()

    await this.categoryRepo.delete(cmd.id, cmd.userId)
  }
}
