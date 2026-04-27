import { BadRequestException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Category, type CategoryType } from "@workspace/api-contract"
import { CategoryRepository } from "../category.repository"

export class CreateCategoryCommand extends Command<Category> {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly parentId: string | null,
    public readonly icon: string | null,
    public readonly type: CategoryType = "expense"
  ) {
    super()
  }
}

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler implements ICommandHandler<CreateCategoryCommand> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(cmd: CreateCategoryCommand): Promise<Category> {
    let type: CategoryType = cmd.type
    if (cmd.parentId !== null) {
      const parent = await this.categoryRepo.findById(cmd.parentId, cmd.organizationId)
      if (parent === null)
        throw new BadRequestException("Parent category not found")
      if (parent.parentId !== null)
        throw new BadRequestException("Subcategories cannot have children")
      type = parent.type as CategoryType
    }

    const row = await this.categoryRepo.insert({
      organizationId: cmd.organizationId,
      parentId: cmd.parentId,
      name: cmd.name,
      type,
      icon: cmd.icon,
    })
    return {
      id: row.id,
      name: row.name,
      type: row.type as CategoryType,
      parentId: row.parentId ?? null,
      icon: row.icon ?? null,
    }
  }
}
