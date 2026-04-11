import { NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { CategoryRepository } from "../category.repository"

export class DeleteCategoryCommand extends Command<void> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string
  ) {
    super()
  }
}

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler implements ICommandHandler<DeleteCategoryCommand> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(cmd: DeleteCategoryCommand): Promise<void> {
    const category = await this.categoryRepo.findById(cmd.id, cmd.organizationId)
    if (category === null) throw new NotFoundException("Category not found")

    await this.categoryRepo.delete(cmd.id, cmd.organizationId)
  }
}
