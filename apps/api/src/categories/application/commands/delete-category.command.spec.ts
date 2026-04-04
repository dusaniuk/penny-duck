import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Category } from "../../domain/entities/category.entity"
import { CategoryNotFoundError } from "../../domain/errors/category.errors"
import { CategoryRepository } from "../../domain/repositories/category.repository"
import {
  DeleteCategoryCommand,
  DeleteCategoryHandler,
} from "./delete-category.command"

describe("DeleteCategoryHandler", () => {
  let handler: DeleteCategoryHandler
  let categoryRepo: CategoryRepository

  beforeEach(() => {
    categoryRepo = {
      findAllByUserId: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      saveMany: vi.fn(),
      delete: vi.fn(),
    } as unknown as CategoryRepository

    handler = new DeleteCategoryHandler(categoryRepo)
  })

  it("deletes the category", async () => {
    const id = faker.string.uuid()
    const userId = faker.string.uuid()
    const category = Category.fromPersistence({
      id,
      userId,
      parentId: null,
      name: "Food",
      icon: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(categoryRepo.findById).mockResolvedValue(category)

    const command = new DeleteCategoryCommand(id, userId)
    await handler.execute(command)
    expect(categoryRepo.delete).toHaveBeenCalledWith(id, userId)
  })

  it("throws CategoryNotFoundError when category does not exist", async () => {
    vi.mocked(categoryRepo.findById).mockResolvedValue(null)
    const command = new DeleteCategoryCommand(
      faker.string.uuid(),
      faker.string.uuid()
    )
    await expect(handler.execute(command)).rejects.toThrow(
      CategoryNotFoundError
    )
  })
})
