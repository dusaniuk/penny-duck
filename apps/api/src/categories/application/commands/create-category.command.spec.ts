import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Category } from "../../domain/entities/category.entity"
import {
  MaxCategoryDepthError,
  ParentCategoryNotFoundError,
} from "../../domain/errors/category.errors"
import { CategoryRepository } from "../../repositories/category.repository"
import {
  CreateCategoryCommand,
  CreateCategoryHandler,
} from "./create-category.command"

describe("CreateCategoryHandler", () => {
  let handler: CreateCategoryHandler
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

    handler = new CreateCategoryHandler(categoryRepo)
  })

  it("creates a top-level category", async () => {
    const command = new CreateCategoryCommand(
      faker.string.uuid(),
      "Food",
      null,
      null
    )
    const result = await handler.execute(command)
    expect(result.name).toBe("Food")
    expect(result.parentId).toBeNull()
    expect(categoryRepo.save).toHaveBeenCalledOnce()
  })

  it("creates a subcategory under a parent", async () => {
    const parentId = faker.string.uuid()
    const userId = faker.string.uuid()
    const parent = Category.fromPersistence({
      id: parentId,
      userId,
      parentId: null,
      name: "Food",
      icon: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(categoryRepo.findById).mockResolvedValue(parent)

    const command = new CreateCategoryCommand(
      userId,
      "Groceries",
      parentId,
      null
    )
    const result = await handler.execute(command)
    expect(result.name).toBe("Groceries")
    expect(result.parentId).toBe(parentId)
    expect(categoryRepo.save).toHaveBeenCalledOnce()
  })

  it("throws ParentCategoryNotFoundError when parent does not exist", async () => {
    vi.mocked(categoryRepo.findById).mockResolvedValue(null)
    const command = new CreateCategoryCommand(
      faker.string.uuid(),
      "Groceries",
      faker.string.uuid(),
      null
    )
    await expect(handler.execute(command)).rejects.toThrow(
      ParentCategoryNotFoundError
    )
  })

  it("throws MaxCategoryDepthError when parent is already a subcategory", async () => {
    const userId = faker.string.uuid()
    const grandParentId = faker.string.uuid()
    const parentId = faker.string.uuid()
    const alreadySubcategory = Category.fromPersistence({
      id: parentId,
      userId,
      parentId: grandParentId,
      name: "Groceries",
      icon: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(categoryRepo.findById).mockResolvedValue(alreadySubcategory)

    const command = new CreateCategoryCommand(userId, "Organic", parentId, null)
    await expect(handler.execute(command)).rejects.toThrow(
      MaxCategoryDepthError
    )
  })
})
