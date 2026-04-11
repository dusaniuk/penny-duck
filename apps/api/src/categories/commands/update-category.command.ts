import { NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Category } from "@workspace/api-contract"
import { CategoryRepository } from "../category.repository"

export class UpdateCategoryCommand extends Command<Category> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly name?: string,
    public readonly icon?: string | null
  ) {
    super()
  }
}

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler implements ICommandHandler<UpdateCategoryCommand> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(cmd: UpdateCategoryCommand): Promise<Category> {
    const existing = await this.categoryRepo.findById(cmd.id, cmd.organizationId)
    if (existing === null) throw new NotFoundException("Category not found")

    const row = await this.categoryRepo.update(cmd.id, cmd.organizationId, {
      name: cmd.name,
      icon: cmd.icon,
    })
    return {
      id: row.id,
      name: row.name,
      parentId: row.parentId ?? null,
      icon: row.icon ?? null,
    }
  }
}
