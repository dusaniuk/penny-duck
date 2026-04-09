import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Category } from "@workspace/api-contract"
import {
  MaxCategoryDepthError,
  ParentCategoryNotFoundError,
} from "../../errors/category.errors"
import { CategoryRepository } from "../../repositories/category.repository"

export class CreateCategoryCommand extends Command<Category> {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly parentId: string | null,
    public readonly icon: string | null
  ) {
    super()
  }
}

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler
  implements ICommandHandler<CreateCategoryCommand>
{
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(cmd: CreateCategoryCommand): Promise<Category> {
    if (cmd.parentId !== null) {
      const parent = await this.categoryRepo.findById(cmd.parentId, cmd.userId)
      if (parent === null) throw new ParentCategoryNotFoundError()
      if (parent.parentId !== null) throw new MaxCategoryDepthError()
    }

    const row = await this.categoryRepo.insert({
      userId: cmd.userId,
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
