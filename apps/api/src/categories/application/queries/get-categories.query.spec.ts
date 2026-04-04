import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Category } from "../../domain/entities/category.entity"
import { CategoryRepository } from "../../domain/repositories/category.repository"
import {
  GetCategoriesHandler,
  GetCategoriesQuery,
} from "./get-categories.query"

describe("GetCategoriesHandler", () => {
  let handler: GetCategoriesHandler
  let categoryRepo: CategoryRepository

  beforeEach(() => {
    categoryRepo = {
      findAllByUserId: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      saveMany: vi.fn(),
      delete: vi.fn(),
    } as unknown as CategoryRepository

    handler = new GetCategoriesHandler(categoryRepo)
  })

  it("returns all categories for a user", async () => {
    const userId = faker.string.uuid()
    const categories = [
      Category.fromPersistence({
        id: faker.string.uuid(),
        userId,
        parentId: null,
        name: "Food",
        icon: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      Category.fromPersistence({
        id: faker.string.uuid(),
        userId,
        parentId: null,
        name: "Transport",
        icon: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ]
    vi.mocked(categoryRepo.findAllByUserId).mockResolvedValue(categories)

    const query = new GetCategoriesQuery(userId)
    const result = await handler.execute(query)
    expect(result).toEqual(categories)
    expect(categoryRepo.findAllByUserId).toHaveBeenCalledWith(userId)
  })
})
