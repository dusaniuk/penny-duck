import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { CategoryNotFoundError } from "../../domain/errors/category.errors"
import { CategoryRepository } from "../../repositories/category.repository"

export class DeleteCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {}
}

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler implements ICommandHandler<DeleteCategoryCommand> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(command: DeleteCategoryCommand): Promise<void> {
    const category = await this.categoryRepo.findById(
      command.id,
      command.userId
    )
    if (category === null) throw new CategoryNotFoundError()

    await this.categoryRepo.delete(command.id, command.userId)
  }
}
