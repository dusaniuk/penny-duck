import { faker } from "@faker-js/faker"
import { describe, expect, it } from "vitest"
import { Category } from "./category.entity"

describe("Category", () => {
  it("creates a top-level category", () => {
    const category = Category.create(
      faker.string.uuid(),
      "Food & Drinks",
      null,
      null
    )
    expect(category.name).toBe("Food & Drinks")
    expect(category.parentId).toBeNull()
    expect(category.icon).toBeNull()
  })
  it("creates a subcategory", () => {
    const parentId = faker.string.uuid()
    const category = Category.create(
      faker.string.uuid(),
      "Groceries",
      parentId,
      "shopping-cart"
    )
    expect(category.name).toBe("Groceries")
    expect(category.parentId).toBe(parentId)
    expect(category.icon).toBe("shopping-cart")
  })
  it("reconstitutes from persistence", () => {
    const id = faker.string.uuid()
    const category = Category.fromPersistence({
      id,
      userId: faker.string.uuid(),
      parentId: null,
      name: "Transport",
      icon: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    expect(category.id).toBe(id)
  })
  it("updates name", () => {
    const category = Category.create(
      faker.string.uuid(),
      "Old Name",
      null,
      null
    )
    category.updateName("New Name")
    expect(category.name).toBe("New Name")
  })
  it("updates icon", () => {
    const category = Category.create(faker.string.uuid(), "Food", null, null)
    category.updateIcon("utensils")
    expect(category.icon).toBe("utensils")
  })
  it("rejects empty name", () => {
    expect(() => Category.create(faker.string.uuid(), "", null, null)).toThrow(
      "Category name cannot be empty"
    )
  })
})
