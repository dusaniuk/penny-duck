import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
  flushEvents,
} from "../test/setup"
import { CreateCategoryCommand } from "./commands/create-category.command"
import { UpdateCategoryCommand } from "./commands/update-category.command"
import { DeleteCategoryCommand } from "./commands/delete-category.command"
import { GetCategoriesQuery } from "./queries/get-categories.query"

let commandBus: CommandBus
let queryBus: QueryBus
let organizationId: string

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
  queryBus = ctx.queryBus
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await flushEvents() // drain async event handlers from previous test
  await truncateAll()
  const result = await signupUser()
  organizationId = result.accessToken.organizationId
  await flushEvents()
})

describe("Categories", () => {
  it("seeds default categories on signup", async () => {
    const categories = await queryBus.execute(new GetCategoriesQuery(organizationId))

    expect(categories.length).toBeGreaterThan(0)
  })

  it("creates a custom category", async () => {
    const category = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "Custom Cat", null, "star")
    )

    expect(category.id).toBeDefined()
    expect(category.name).toBe("Custom Cat")
    expect(category.icon).toBe("star")
  })

  it("creates a subcategory", async () => {
    const parent = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "Parent", null, null)
    )

    const child = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "Child", parent.id, null)
    )

    expect(child.parentId).toBe(parent.id)
  })

  it("updates a category", async () => {
    const category = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "Old Name", null, null)
    )

    const updated = await commandBus.execute(
      new UpdateCategoryCommand(category.id, organizationId, "New Name", "heart")
    )

    expect(updated.name).toBe("New Name")
    expect(updated.icon).toBe("heart")
  })

  it("deletes a category", async () => {
    const category = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "To Delete", null, null)
    )

    const beforeDelete = await queryBus.execute(new GetCategoriesQuery(organizationId))
    const countBefore = beforeDelete.length

    await commandBus.execute(new DeleteCategoryCommand(category.id, organizationId))

    const afterDelete = await queryBus.execute(new GetCategoriesQuery(organizationId))
    expect(afterDelete.length).toBe(countBefore - 1)
  })

  it("promotes a subcategory to top-level", async () => {
    const parent = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "Parent", null, null)
    )
    const child = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "Child", parent.id, null)
    )

    const promoted = await commandBus.execute(
      new UpdateCategoryCommand(
        child.id,
        organizationId,
        undefined,
        undefined,
        undefined,
        null
      )
    )

    expect(promoted.parentId).toBeNull()

    const all = await queryBus.execute(new GetCategoriesQuery(organizationId))
    const refetched = all.find((c: { id: string }) => c.id === child.id)
    expect(refetched?.parentId).toBeNull()
  })

  it("rejects promoting a category that is already top-level", async () => {
    const parent = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "AlreadyTop", null, null)
    )

    await expect(
      commandBus.execute(
        new UpdateCategoryCommand(
          parent.id,
          organizationId,
          undefined,
          undefined,
          undefined,
          null
        )
      )
    ).rejects.toThrow(/already top-level/i)
  })

  it("reparents a subcategory between two same-type parents", async () => {
    const parentA = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "ParentA", null, null)
    )
    const parentB = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "ParentB", null, null)
    )
    const child = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "Child", parentA.id, null)
    )

    const moved = await commandBus.execute(
      new UpdateCategoryCommand(
        child.id,
        organizationId,
        undefined,
        undefined,
        undefined,
        parentB.id
      )
    )

    expect(moved.parentId).toBe(parentB.id)
  })

  it("rejects cross-type reparent", async () => {
    const expenseParent = await commandBus.execute(
      new CreateCategoryCommand(
        organizationId,
        "ExpenseParent",
        null,
        null,
        "expense"
      )
    )
    const incomeParent = await commandBus.execute(
      new CreateCategoryCommand(
        organizationId,
        "IncomeParent",
        null,
        null,
        "income"
      )
    )
    const child = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "Child", expenseParent.id, null)
    )

    await expect(
      commandBus.execute(
        new UpdateCategoryCommand(
          child.id,
          organizationId,
          undefined,
          undefined,
          undefined,
          incomeParent.id
        )
      )
    ).rejects.toThrow(/match category type/i)
  })

  it("rejects demoting a parent that has subcategories", async () => {
    const parentA = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "ParentA", null, null)
    )
    const parentB = await commandBus.execute(
      new CreateCategoryCommand(organizationId, "ParentB", null, null)
    )
    await commandBus.execute(
      new CreateCategoryCommand(organizationId, "ChildOfA", parentA.id, null)
    )

    await expect(
      commandBus.execute(
        new UpdateCategoryCommand(
          parentA.id,
          organizationId,
          undefined,
          undefined,
          undefined,
          parentB.id
        )
      )
    ).rejects.toThrow(/has subcategories/i)
  })

  it("isolates categories between users", async () => {
    const other = await signupUser()
    await flushEvents()

    await commandBus.execute(
      new CreateCategoryCommand(organizationId, "User1 Cat", null, null)
    )
    await commandBus.execute(
      new CreateCategoryCommand(other.accessToken.organizationId, "User2 Cat", null, null)
    )

    const user1Cats = await queryBus.execute(new GetCategoriesQuery(organizationId))
    const user2Cats = await queryBus.execute(
      new GetCategoriesQuery(other.accessToken.organizationId)
    )

    const user1Custom = user1Cats.find(
      (c: { name: string }) => c.name === "User1 Cat"
    )
    const user2Custom = user2Cats.find(
      (c: { name: string }) => c.name === "User2 Cat"
    )
    expect(user1Custom).toBeDefined()
    expect(user2Custom).toBeDefined()

    expect(
      user1Cats.find((c: { name: string }) => c.name === "User2 Cat")
    ).toBeUndefined()
  })
})
