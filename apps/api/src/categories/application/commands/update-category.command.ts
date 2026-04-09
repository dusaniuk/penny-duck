import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { Category } from "../../domain/entities/category.entity"
import { CategoryNotFoundError } from "../../domain/errors/category.errors"
import { CategoryRepository } from "../../repositories/category.repository"

export class UpdateCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly icon?: string | null
  ) {}
}

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler implements ICommandHandler<UpdateCategoryCommand> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(command: UpdateCategoryCommand): Promise<Category> {
    const category = await this.categoryRepo.findById(
      command.id,
      command.userId
    )
    if (category === null) throw new CategoryNotFoundError()

    if (command.name !== undefined) category.updateName(command.name)
    if (command.icon !== undefined) category.updateIcon(command.icon)

    return this.categoryRepo.save(category)
  }
}
