import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Category } from "../../domain/entities/category.entity"
import { CategoryNotFoundError } from "../../domain/errors/category.errors"
import { CategoryRepository } from "../../domain/repositories/category.repository"
import {
  UpdateCategoryCommand,
  UpdateCategoryHandler,
} from "./update-category.command"

describe("UpdateCategoryHandler", () => {
  let handler: UpdateCategoryHandler
  let categoryRepo: CategoryRepository

  const makeCategory = (
    overrides?: Partial<Parameters<typeof Category.fromPersistence>[0]>
  ) =>
    Category.fromPersistence({
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      parentId: null,
      name: "Food",
      icon: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })

  beforeEach(() => {
    categoryRepo = {
      findAllByUserId: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (cat: Category) => {
        return Category.fromPersistence({
          id: cat.id,
          userId: cat.userId,
          parentId: cat.parentId,
          name: cat.name,
          icon: cat.icon,
          createdAt: cat.createdAt,
          updatedAt: new Date(),
        })
      }),
      saveMany: vi.fn(),
      delete: vi.fn(),
    } as unknown as CategoryRepository

    handler = new UpdateCategoryHandler(categoryRepo)
  })

  it("updates the category name", async () => {
    const category = makeCategory({ name: "Food" })
    vi.mocked(categoryRepo.findById).mockResolvedValue(category)

    const command = new UpdateCategoryCommand(
      category.id,
      category.userId,
      "Dining"
    )
    const result = await handler.execute(command)
    expect(result.name).toBe("Dining")
    expect(categoryRepo.save).toHaveBeenCalledOnce()
  })

  it("updates the category icon", async () => {
    const category = makeCategory({ icon: null })
    vi.mocked(categoryRepo.findById).mockResolvedValue(category)

    const command = new UpdateCategoryCommand(
      category.id,
      category.userId,
      undefined,
      "🍔"
    )
    const result = await handler.execute(command)
    expect(result.icon).toBe("🍔")
    expect(categoryRepo.save).toHaveBeenCalledOnce()
  })

  it("throws CategoryNotFoundError when category does not exist", async () => {
    vi.mocked(categoryRepo.findById).mockResolvedValue(null)
    const command = new UpdateCategoryCommand(
      faker.string.uuid(),
      faker.string.uuid(),
      "New Name"
    )
    await expect(handler.execute(command)).rejects.toThrow(
      CategoryNotFoundError
    )
  })
})
