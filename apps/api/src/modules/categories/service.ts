import { and, eq, gte, isNotNull, isNull, ne, sql } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import { accounts, categories, transactions, users } from "@workspace/db"
import {
  type Category,
  type CategoryType,
  type CategoryUsageItem,
} from "@workspace/api-contract"
import { DEFAULT_CATEGORY_SET } from "@workspace/shared/categories"
import { getRate } from "@/modules/exchange-rates/service"
import { db } from "@/db"

const DEFAULT_HOME_CURRENCY = "UAH"

async function getHomeCurrency(userId: string): Promise<string> {
  const rows = await db
    .select({ homeCurrency: users.homeCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return rows[0]?.homeCurrency ?? DEFAULT_HOME_CURRENCY
}

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
  organizationId: string
): Promise<CategoryRow | null> {
  const rows = await executor
    .select()
    .from(categories)
    .where(
      and(eq(categories.id, id), eq(categories.organizationId, organizationId))
    )
    .limit(1)
  return rows[0] ?? null
}

async function hasChildren(
  executor: Executor,
  parentId: string,
  organizationId: string
): Promise<boolean> {
  const rows = await executor
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.parentId, parentId),
        eq(categories.organizationId, organizationId)
      )
    )
    .limit(1)
  return rows.length > 0
}

export async function listCategories(
  organizationId: string
): Promise<Category[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.organizationId, organizationId))
  return rows.map(toResponse)
}

// Per-category transaction aggregates, scoped to the org. Transfers carry no
// category and drop out via the IS NOT NULL guard.
//
// `count` is the all-time tally of categorized transactions — it drives the
// transaction-form "most used" grid and the delete-dialog warning, so its
// semantics are kept exactly as before. The current-month cash-flow stats
// (countThisMonth/spentThisMonth/lastActivityAt) apply the same exclusions as
// the spendings view: reimbursement legs and brokerage-account rows.
//
// Counts and last-activity are pure SQL (no money involved). `spentThisMonth`
// must be in the user's home currency, but `amount` is stored in each account's
// own currency — so, like listTransactions, we convert each row with
// getRate(accountCurrency -> home, date) and aggregate in JS. (A single SQL SUM
// would silently mix currencies.)
export async function getCategoryUsage(
  organizationId: string,
  userId: string
): Promise<CategoryUsageItem[]> {
  const now = new Date()
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  )
  const cashFlow = sql`${transactions.reimbursementId} is null and ${accounts.type} <> 'brokerage'`
  const thisMonth = sql`${cashFlow} and ${transactions.date} >= ${monthStart}`

  const aggRows = await db
    .select({
      categoryId: transactions.categoryId,
      count: sql<number>`count(*)::int`,
      countThisMonth: sql<number>`count(*) filter (where ${thisMonth})::int`,
      lastActivity: sql<
        string | null
      >`max(${transactions.date}) filter (where ${cashFlow})`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        eq(transactions.organizationId, organizationId),
        isNotNull(transactions.categoryId)
      )
    )
    .groupBy(transactions.categoryId)

  // This month's cash-flow rows, with each account's currency, for conversion.
  const monthRows = await db
    .select({
      categoryId: transactions.categoryId,
      amount: transactions.amount,
      date: transactions.date,
      currency: accounts.currency,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        eq(transactions.organizationId, organizationId),
        isNotNull(transactions.categoryId),
        isNull(transactions.reimbursementId),
        ne(accounts.type, "brokerage"),
        gte(transactions.date, monthStart)
      )
    )

  const homeCurrency = await getHomeCurrency(userId)
  // Include the home currency: it's the conversion *target*, and getRate filters
  // fetched rates down to this list — omitting it drops the rate we need.
  const usedCurrencies = [
    ...new Set([...monthRows.map((r) => r.currency), homeCurrency]),
  ]
  const spentByCategory = new Map<string, number>()
  for (const row of monthRows) {
    if (row.categoryId === null) continue
    // `amount` comes through the money column type, so it's already in major
    // units of the account's currency (e.g. 1000.00 UAH), matching listTransactions.
    let home = Math.abs(row.amount)
    if (row.currency && row.currency !== homeCurrency) {
      const rate = await getRate(
        row.currency,
        homeCurrency,
        row.date,
        usedCurrencies
      )
      home = Math.abs(row.amount) * rate
    }
    spentByCategory.set(
      row.categoryId,
      (spentByCategory.get(row.categoryId) ?? 0) + home
    )
  }

  return aggRows
    .filter((r) => r.categoryId !== null)
    .map((r) => ({
      categoryId: r.categoryId as string,
      count: r.count,
      countThisMonth: r.countThisMonth,
      spentThisMonth: spentByCategory.get(r.categoryId as string) ?? 0,
      lastActivityAt: r.lastActivity
        ? new Date(r.lastActivity).toISOString()
        : null,
    }))
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
  input: CreateCategoryInput
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
  input: UpdateCategoryInput
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
          message:
            "A color is required when promoting a subcategory to top-level",
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
          input.organizationId
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
        message:
          "Subcategory type is inherited from parent and cannot be changed directly",
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
          eq(categories.organizationId, input.organizationId)
        )
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
            eq(categories.organizationId, input.organizationId)
          )
        )
    }

    return toResponse(row)
  })
}

export async function deleteCategory(
  id: string,
  organizationId: string
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
          eq(categories.organizationId, organizationId)
        )
      )
    await tx
      .delete(categories)
      .where(
        and(
          eq(categories.id, id),
          eq(categories.organizationId, organizationId)
        )
      )
  })
}

export async function seedDefaultCategories(
  organizationId: string
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
          }))
        )
        .returning()
      created.push(...childRows)
    }

    return created.map(toResponse)
  })
}
