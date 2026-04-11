import { BadRequestException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Category } from "@workspace/api-contract"
import { CategoryRepository } from "../category.repository"

export class CreateCategoryCommand extends Command<Category> {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly parentId: string | null,
    public readonly icon: string | null
  ) {
    super()
  }
}

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler implements ICommandHandler<CreateCategoryCommand> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(cmd: CreateCategoryCommand): Promise<Category> {
    if (cmd.parentId !== null) {
      const parent = await this.categoryRepo.findById(cmd.parentId, cmd.organizationId)
      if (parent === null)
        throw new BadRequestException("Parent category not found")
      if (parent.parentId !== null)
        throw new BadRequestException("Subcategories cannot have children")
    }

    const row = await this.categoryRepo.insert({
      organizationId: cmd.organizationId,
      parentId: cmd.parentId,
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
