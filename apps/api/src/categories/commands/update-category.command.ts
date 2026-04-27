import { BadRequestException, NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Category, type CategoryType } from "@workspace/api-contract"
import { CategoryRepository } from "../category.repository"

export class UpdateCategoryCommand extends Command<Category> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly name?: string,
    public readonly icon?: string | null,
    public readonly type?: CategoryType,
    public readonly parentId?: string | null
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

    if (cmd.parentId !== undefined) {
      if (cmd.parentId === cmd.id) {
        throw new BadRequestException("Cannot move category into itself")
      }

      if (cmd.parentId === null && existing.parentId === null) {
        throw new BadRequestException("Category is already top-level")
      }

      if (cmd.parentId !== null && cmd.parentId !== existing.parentId) {
        const target = await this.categoryRepo.findById(
          cmd.parentId,
          cmd.organizationId
        )
        if (target === null) {
          throw new BadRequestException("Target parent not found")
        }
        if (target.parentId !== null) {
          throw new BadRequestException("Target parent must be top-level")
        }
        if (target.type !== existing.type) {
          throw new BadRequestException(
            "Target parent must match category type"
          )
        }
        const hasChildren = await this.categoryRepo.hasChildren(
          cmd.id,
          cmd.organizationId
        )
        if (hasChildren) {
          throw new BadRequestException(
            "Cannot move a category that has subcategories"
          )
        }
      }
    }

    if (cmd.type !== undefined && existing.parentId !== null) {
      throw new BadRequestException(
        "Subcategory type is inherited from parent and cannot be changed directly"
      )
    }

    const row = await this.categoryRepo.update(cmd.id, cmd.organizationId, {
      name: cmd.name,
      icon: cmd.icon,
      type: cmd.type,
      ...(cmd.parentId !== undefined ? { parentId: cmd.parentId } : {}),
    })

    if (
      cmd.type !== undefined &&
      existing.parentId === null &&
      cmd.type !== existing.type
    ) {
      await this.categoryRepo.updateChildrenType(
        cmd.id,
        cmd.organizationId,
        cmd.type
      )
    }

    return {
      id: row.id,
      name: row.name,
      type: row.type as CategoryType,
      parentId: row.parentId ?? null,
      icon: row.icon ?? null,
    }
  }
}
