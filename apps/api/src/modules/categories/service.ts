import { and, eq, isNotNull, sql } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import { categories, transactions } from "@workspace/db"
import {
  type Category,
  type CategoryType,
  type CategoryUsageItem,
} from "@workspace/api-contract"
import { DEFAULT_CATEGORY_SET } from "@workspace/shared/categories"
import { db } from "@/db"

type CategoryRow = typeof categories.$inferSelect
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

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

// Count of transactions per category, scoped to the org. Used by the
// transaction-form category grid to surface most-used categories first.
// Transfers and reimbursements have no category and are filtered out by
// the IS NOT NULL guard.
export async function getCategoryUsage(
  organizationId: string,
): Promise<CategoryUsageItem[]> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.organizationId, organizationId),
        isNotNull(transactions.categoryId),
      ),
    )
    .groupBy(transactions.categoryId)

  return rows
    .filter((r): r is { categoryId: string; count: number } =>
      r.categoryId !== null,
    )
    .map((r) => ({ categoryId: r.categoryId, count: r.count }))
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
): Promise<Category[]> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.organizationId, organizationId))
      .limit(1)
    if (existing.length > 0) {
      throw new HTTPException(409, { message: "Categories already exist" })
    }

    const created: CategoryRow[] = []
    for (const group of DEFAULT_CATEGORY_SET) {
      const [parent] = await tx
        .insert(categories)
        .values({
          organizationId,
          parentId: null,
          name: group.name,
          type: group.type,
          icon: group.icon,
          color: group.color,
        })
        .returning()
      created.push(parent)

      if (group.children.length === 0) continue
      const childRows = await tx
        .insert(categories)
        .values(
          group.children.map((child) => ({
            organizationId,
            parentId: parent.id,
            name: child.name,
            type: group.type,
            icon: child.icon,
          })),
        )
        .returning()
      created.push(...childRows)
    }

    return created.map(toResponse)
  })
}
