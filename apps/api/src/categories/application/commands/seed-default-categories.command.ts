import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { Category } from "../../domain/entities/category.entity"
import { CategoryRepository } from "../../repositories/category.repository"

export class SeedDefaultCategoriesCommand {
  constructor(public readonly userId: string) {}
}

interface DefaultCategory {
  icon: string | null
  children: Array<{ name: string; icon: string | null }>
}

const DEFAULT_CATEGORIES: Record<string, DefaultCategory> = {
  "Food & Drinks": {
    icon: "pizza",
    children: [
      { name: "Groceries", icon: "shopping-cart" },
      { name: "Restaurants", icon: "meat" },
      { name: "Coffee & Bars", icon: "coffee" },
    ],
  },
  Transport: {
    icon: "car",
    children: [
      { name: "Public Transit", icon: "bus" },
      { name: "Taxi", icon: "car" },
      { name: "Fuel", icon: "gas-station" },
    ],
  },
  Housing: {
    icon: "home",
    children: [
      { name: "Rent", icon: "home" },
      { name: "Utilities", icon: "bolt" },
      { name: "Maintenance", icon: "tool" },
    ],
  },
  Shopping: {
    icon: "shopping-bag",
    children: [
      { name: "Clothes", icon: "shirt" },
      { name: "Electronics", icon: "credit-card" },
      { name: "Gifts", icon: "gift" },
    ],
  },
  Entertainment: {
    icon: "ticket",
    children: [
      { name: "Subscriptions", icon: "movie" },
      { name: "Hobbies", icon: "device-gamepad" },
      { name: "Events", icon: "ticket" },
    ],
  },
  Health: {
    icon: "heartbeat",
    children: [
      { name: "Pharmacy", icon: "pill" },
      { name: "Doctor", icon: "heartbeat" },
      { name: "Sports", icon: "ball-tennis" },
    ],
  },
  Income: {
    icon: "cash",
    children: [
      { name: "Salary", icon: "building-bank" },
      { name: "Freelance", icon: "briefcase" },
      { name: "Other", icon: "coin" },
    ],
  },
}

@CommandHandler(SeedDefaultCategoriesCommand)
export class SeedDefaultCategoriesHandler implements ICommandHandler<SeedDefaultCategoriesCommand> {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(command: SeedDefaultCategoriesCommand): Promise<void> {
    for (const [parentName, category] of Object.entries(DEFAULT_CATEGORIES)) {
      const parentCategory = Category.create(
        command.userId,
        parentName,
        null,
        category.icon
      )
      const savedParent = await this.categoryRepo.save(parentCategory)

      const subcategories = category.children.map((child) =>
        Category.create(command.userId, child.name, savedParent.id, child.icon)
      )
      await this.categoryRepo.saveMany(subcategories)
    }
  }
}
