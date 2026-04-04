import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { Category } from "../../domain/entities/category.entity"
import { CategoryRepository } from "../../domain/repositories/category.repository"

export class SeedDefaultCategoriesCommand {
  constructor(public readonly userId: string) {}
}

const DEFAULT_CATEGORIES: Record<string, string[]> = {
  "Food & Drinks": ["Groceries", "Restaurants", "Coffee & Bars"],
  Transport: ["Public Transit", "Taxi", "Fuel"],
  Housing: ["Rent", "Utilities", "Maintenance"],
  Shopping: ["Clothes", "Electronics", "Gifts"],
  Entertainment: ["Subscriptions", "Hobbies", "Events"],
  Health: ["Pharmacy", "Doctor", "Sports"],
  Income: ["Salary", "Freelance", "Other"],
}

@CommandHandler(SeedDefaultCategoriesCommand)
export class SeedDefaultCategoriesHandler implements ICommandHandler<SeedDefaultCategoriesCommand> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(command: SeedDefaultCategoriesCommand): Promise<void> {
    for (const [parentName, childNames] of Object.entries(DEFAULT_CATEGORIES)) {
      const parentCategory = Category.create(
        command.userId,
        parentName,
        null,
        null
      )
      const savedParent = await this.categoryRepo.save(parentCategory)

      const subcategories = childNames.map((name) =>
        Category.create(command.userId, name, savedParent.id, null)
      )
      await this.categoryRepo.saveMany(subcategories)
    }
  }
}
