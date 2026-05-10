import { and, eq } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import { categories } from "@workspace/db"
import { type Category, type CategoryType } from "@workspace/api-contract"
import { db } from "@/hono/db"

type CategoryRow = typeof categories.$inferSelect
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

interface DefaultCategory {
  icon: string | null
  type: CategoryType
  color: string
  children: Array<{ name: string; icon: string | null }>
}

const DEFAULT_CATEGORIES: Record<string, DefaultCategory> = {
  "Food & Drinks": {
    icon: "pizza",
    type: "expense",
    color: "red",
    children: [
      { name: "Groceries", icon: "shopping-cart" },
      { name: "Restaurants", icon: "meat" },
      { name: "Coffee & Bars", icon: "coffee" },
    ],
  },
  Transport: {
    icon: "car",
    type: "expense",
    color: "blue",
    children: [
      { name: "Public Transit", icon: "bus" },
      { name: "Taxi", icon: "car" },
      { name: "Fuel", icon: "gas-station" },
    ],
  },
  Housing: {
    icon: "home",
    type: "expense",
    color: "orange",
    children: [
      { name: "Rent", icon: "home" },
      { name: "Utilities", icon: "bolt" },
      { name: "Maintenance", icon: "tool" },
    ],
  },
  Shopping: {
    icon: "shopping-bag",
    type: "expense",
    color: "purple",
    children: [
      { name: "Clothes", icon: "shirt" },
      { name: "Electronics", icon: "credit-card" },
      { name: "Gifts", icon: "gift" },
    ],
  },
  Entertainment: {
    icon: "ticket",
    type: "expense",
    color: "magenta",
    children: [
      { name: "Subscriptions", icon: "movie" },
      { name: "Hobbies", icon: "device-gamepad" },
      { name: "Events", icon: "ticket" },
    ],
  },
  Health: {
    icon: "heartbeat",
    type: "expense",
    color: "green",
    children: [
      { name: "Pharmacy", icon: "pill" },
      { name: "Doctor", icon: "heartbeat" },
      { name: "Sports", icon: "ball-tennis" },
    ],
  },
  Income: {
    icon: "cash",
    type: "income",
    color: "emerald",
    children: [
      { name: "Salary", icon: "building-bank" },
      { name: "Freelance", icon: "briefcase" },
      { name: "Other", icon: "coin" },
    ],
  },
}

function toResponse(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type as CategoryType,
    parentId: row.parentId ?? null,
    icon: row.icon ?? null,
    color: row.color ?? null,
  }
}

async function findById(
  executor: Executor,
  id: string,
  organizationId: string,
): Promise<CategoryRow | null> {
  const rows = await executor
    .select()
    .from(categories)
    .where(
      and(eq(categories.id, id), eq(categories.organizationId, organizationId)),
    )
    .limit(1)
  return rows[0] ?? null
}

async function hasChildren(
  executor: Executor,
  parentId: string,
  organizationId: string,
): Promise<boolean> {
  const rows = await executor
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.parentId, parentId),
        eq(categories.organizationId, organizationId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

export async function listCategories(
  organizationId: string,
): Promise<Category[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.organizationId, organizationId))
  return rows.map(toResponse)
}

export interface CreateCategoryInput {
  organizationId: string
  name: string
  parentId: string | null
  icon: string | null
  type: CategoryType
  color: string | null
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  let type: CategoryType = input.type
  if (input.parentId !== null) {
    if (input.color !== null) {
      throw new HTTPException(400, {
        message: "Subcategories cannot have a color",
      })
    }
    const parent = await findById(db, input.parentId, input.organizationId)
    if (parent === null) {
      throw new HTTPException(400, { message: "Parent category not found" })
    }
    if (parent.parentId !== null) {
      throw new HTTPException(400, {
        message: "Subcategories cannot have children",
      })
    }
    type = parent.type as CategoryType
  } else if (input.color === null) {
    throw new HTTPException(400, {
      message: "Top-level categories require a color",
    })
  }

  const color = input.parentId === null ? input.color : null

  const [row] = await db
    .insert(categories)
    .values({
      organizationId: input.organizationId,
      parentId: input.parentId,
      name: input.name,
      type,
      icon: input.icon,
      color,
    })
    .returning()
  return toResponse(row)
}

export interface UpdateCategoryInput {
  id: string
  organizationId: string
  name?: string
  icon?: string | null
  type?: CategoryType
  parentId?: string | null
  color?: string
}

export async function updateCategory(
  input: UpdateCategoryInput,
): Promise<Category> {
  return db.transaction(async (tx) => {
    const existing = await findById(tx, input.id, input.organizationId)
    if (existing === null) {
      throw new HTTPException(404, { message: "Category not found" })
    }

    const isStayingChild =
      existing.parentId !== null &&
      (input.parentId === undefined || input.parentId !== null)
    if (isStayingChild && input.color !== undefined) {
      throw new HTTPException(400, {
        message: "Subcategories cannot have a color",
      })
    }

    if (input.parentId !== undefined) {
      if (input.parentId === input.id) {
        throw new HTTPException(400, {
          message: "Cannot move category into itself",
        })
      }

      if (input.parentId === null && existing.parentId === null) {
        throw new HTTPException(400, {
          message: "Category is already top-level",
        })
      }

      if (
        input.parentId === null &&
        existing.parentId !== null &&
        (input.color === undefined || input.color === null)
      ) {
        throw new HTTPException(400, {
          message: "A color is required when promoting a subcategory to top-level",
        })
      }

      if (input.parentId !== null && input.parentId !== existing.parentId) {
        const target = await findById(tx, input.parentId, input.organizationId)
        if (target === null) {
          throw new HTTPException(400, { message: "Target parent not found" })
        }
        if (target.parentId !== null) {
          throw new HTTPException(400, {
            message: "Target parent must be top-level",
          })
        }
        if (target.type !== existing.type) {
          throw new HTTPException(400, {
            message: "Target parent must match category type",
          })
        }
        const childOfMoving = await hasChildren(
          tx,
          input.id,
          input.organizationId,
        )
        if (childOfMoving) {
          throw new HTTPException(400, {
            message: "Cannot move a category that has subcategories",
          })
        }
      }
    }

    if (input.type !== undefined && existing.parentId !== null) {
      throw new HTTPException(400, {
        message: "Subcategory type is inherited from parent and cannot be changed directly",
      })
    }

    let nextColor: string | null | undefined
    if (input.parentId === null && existing.parentId !== null) {
      nextColor = input.color
    } else if (input.parentId !== null && input.parentId !== undefined) {
      nextColor = null
    } else if (input.color !== undefined && existing.parentId === null) {
      nextColor = input.color
    }

    const [row] = await tx
      .update(categories)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(nextColor !== undefined ? { color: nextColor } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(categories.id, input.id),
          eq(categories.organizationId, input.organizationId),
        ),
      )
      .returning()

    if (
      input.type !== undefined &&
      existing.parentId === null &&
      input.type !== existing.type
    ) {
      await tx
        .update(categories)
        .set({ type: input.type, updatedAt: new Date() })
        .where(
          and(
            eq(categories.parentId, input.id),
            eq(categories.organizationId, input.organizationId),
          ),
        )
    }

    return toResponse(row)
  })
}

export async function deleteCategory(
  id: string,
  organizationId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await findById(tx, id, organizationId)
    if (existing === null) {
      throw new HTTPException(404, { message: "Category not found" })
    }
    await tx
      .delete(categories)
      .where(
        and(
          eq(categories.parentId, id),
          eq(categories.organizationId, organizationId),
        ),
      )
    await tx
      .delete(categories)
      .where(
        and(
          eq(categories.id, id),
          eq(categories.organizationId, organizationId),
        ),
      )
  })
}

export async function seedDefaultCategories(
  organizationId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [parentName, category] of Object.entries(DEFAULT_CATEGORIES)) {
      const [parent] = await tx
        .insert(categories)
        .values({
          organizationId,
          parentId: null,
          name: parentName,
          type: category.type,
          icon: category.icon,
          color: category.color,
        })
        .returning()

      if (category.children.length === 0) continue
      await tx.insert(categories).values(
        category.children.map((child) => ({
          organizationId,
          parentId: parent.id,
          name: child.name,
          type: category.type,
          icon: child.icon,
        })),
      )
    }
  })
}
