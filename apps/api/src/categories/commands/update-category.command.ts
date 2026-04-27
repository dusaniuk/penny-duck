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
    public readonly parentId?: string | null,
    public readonly color?: string
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

    // Reject color edits on rows that are (and stay) children
    const isStayingChild =
      existing.parentId !== null &&
      (cmd.parentId === undefined || cmd.parentId !== null)
    if (isStayingChild && cmd.color !== undefined) {
      throw new BadRequestException("Subcategories cannot have a color")
    }

    if (cmd.parentId !== undefined) {
      if (cmd.parentId === cmd.id) {
        throw new BadRequestException("Cannot move category into itself")
      }

      if (cmd.parentId === null && existing.parentId === null) {
        throw new BadRequestException("Category is already top-level")
      }

      // Promotion (child → parent) requires color
      if (
        cmd.parentId === null &&
        existing.parentId !== null &&
        (cmd.color === undefined || cmd.color === null)
      ) {
        throw new BadRequestException(
          "A color is required when promoting a subcategory to top-level"
        )
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

    // Compute next color value
    let nextColor: string | null | undefined
    if (cmd.parentId === null && existing.parentId !== null) {
      // Promotion — color was validated as required above
      nextColor = cmd.color
    } else if (cmd.parentId !== null && cmd.parentId !== undefined) {
      // Demotion (or sideways move staying child) — clear color
      nextColor = null
    } else if (cmd.color !== undefined && existing.parentId === null) {
      // Editing existing top-level row
      nextColor = cmd.color
    }

    const row = await this.categoryRepo.update(cmd.id, cmd.organizationId, {
      name: cmd.name,
      icon: cmd.icon,
      type: cmd.type,
      ...(cmd.parentId !== undefined ? { parentId: cmd.parentId } : {}),
      ...(nextColor !== undefined ? { color: nextColor } : {}),
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
      color: row.color ?? null,
    }
  }
}
