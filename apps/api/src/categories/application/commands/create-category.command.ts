import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { Category } from "../../domain/entities/category.entity"
import {
  MaxCategoryDepthError,
  ParentCategoryNotFoundError,
} from "../../domain/errors/category.errors"
import { CategoryRepository } from "../../repositories/category.repository"

export class CreateCategoryCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly parentId: string | null,
    public readonly icon: string | null
  ) {}
}

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler implements ICommandHandler<CreateCategoryCommand> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(command: CreateCategoryCommand): Promise<Category> {
    if (command.parentId !== null) {
      const parent = await this.categoryRepo.findById(
        command.parentId,
        command.userId
      )
      if (parent === null) throw new ParentCategoryNotFoundError()
      if (parent.parentId !== null) throw new MaxCategoryDepthError()
    }

    const category = Category.create(
      command.userId,
      command.name,
      command.parentId,
      command.icon
    )
    return this.categoryRepo.save(category)
  }
}
