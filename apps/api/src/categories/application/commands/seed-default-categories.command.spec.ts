import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Category } from "../../domain/entities/category.entity"
import { CategoryRepository } from "../../domain/repositories/category.repository"
import {
  SeedDefaultCategoriesCommand,
  SeedDefaultCategoriesHandler,
} from "./seed-default-categories.command"

describe("SeedDefaultCategoriesHandler", () => {
  let handler: SeedDefaultCategoriesHandler
  let categoryRepo: CategoryRepository

  beforeEach(() => {
    categoryRepo = {
      findAllByUserId: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (cat: Category) => {
        return Category.fromPersistence({
          id: faker.string.uuid(),
          userId: cat.userId,
          parentId: cat.parentId,
          name: cat.name,
          icon: cat.icon,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }),
      saveMany: vi.fn().mockImplementation(async (cats: Category[]) => {
        return cats.map((cat) =>
          Category.fromPersistence({
            id: faker.string.uuid(),
            userId: cat.userId,
            parentId: cat.parentId,
            name: cat.name,
            icon: cat.icon,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
      }),
      delete: vi.fn(),
    } as unknown as CategoryRepository

    handler = new SeedDefaultCategoriesHandler(categoryRepo)
  })

  it("saves 7 parent categories and calls saveMany for each group of subcategories", async () => {
    const userId = faker.string.uuid()
    const command = new SeedDefaultCategoriesCommand(userId)
    await handler.execute(command)

    expect(categoryRepo.save).toHaveBeenCalledTimes(7)
    expect(categoryRepo.saveMany).toHaveBeenCalledTimes(7)
  })

  it("creates subcategories with the parent id returned from save", async () => {
    const userId = faker.string.uuid()
    const command = new SeedDefaultCategoriesCommand(userId)
    await handler.execute(command)

    const saveManyMock = vi.mocked(categoryRepo.saveMany)
    for (const call of saveManyMock.mock.calls) {
      const subcategories = call[0] as Category[]
      expect(subcategories.length).toBeGreaterThan(0)
      const parentId = subcategories[0].parentId
      expect(parentId).not.toBeNull()
      for (const sub of subcategories) {
        expect(sub.parentId).toBe(parentId)
      }
    }
  })
})
