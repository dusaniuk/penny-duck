import { eq } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import {
  accounts,
  categories,
  organizations,
  transactions,
  users,
} from "@workspace/db"
import { isValidCurrencyCode } from "@workspace/shared/currencies"
import { db } from "@/db"
import {
  deleteOrganization,
  findUserMemberships,
  hasOtherOwners,
} from "@/modules/organizations/service"

export interface CurrentUserResult {
  id: string
  email: string
  name: string
  homeCurrency: string
}

function toCurrentUser(row: typeof users.$inferSelect): CurrentUserResult {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    homeCurrency: row.homeCurrency,
  }
}

export async function getCurrentUser(
  userId: string
): Promise<CurrentUserResult> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!rows[0]) throw new HTTPException(401, { message: "Unauthorized" })
  return toCurrentUser(rows[0])
}

export interface UpdateProfileInput {
  name?: string
  homeCurrency?: string
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<CurrentUserResult> {
  if (input.homeCurrency && !isValidCurrencyCode(input.homeCurrency)) {
    throw new HTTPException(400, { message: "Invalid currency code" })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) updates.name = input.name
  if (input.homeCurrency !== undefined)
    updates.homeCurrency = input.homeCurrency

  const rows = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning()

  if (!rows[0]) throw new HTTPException(404, { message: "User not found" })
  return toCurrentUser(rows[0])
}

export async function deleteAccount(
  userId: string,
  confirmEmail: string
): Promise<{ message: string }> {
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const user = userRows[0]
  if (!user) throw new HTTPException(404, { message: "User not found" })

  if (user.email !== confirmEmail) {
    throw new HTTPException(400, { message: "Email does not match" })
  }

  const memberships = await findUserMemberships(userId)
  for (const membership of memberships) {
    if (membership.role !== "owner") continue
    const otherOwners = await hasOtherOwners(membership.organizationId, userId)
    if (!otherOwners) {
      await deleteOrganization(membership.organizationId)
    }
  }

  await db.delete(users).where(eq(users.id, userId))

  return { message: "Account deleted successfully" }
}

export interface ExportData {
  exportedAt: string
  user: CurrentUserResult
  organization: { id: string; name: string } | null
  accounts: Array<{
    id: string
    name: string
    type: string
    currency: string
    initialBalance: number
    createdAt: string
  }>
  categories: Array<{
    id: string
    name: string
    icon: string | null
    parentId: string | null
    createdAt: string
  }>
  transactions: Array<{
    id: string
    amount: number
    note: string | null
    date: string
    settled: boolean
    accountId: string
    categoryId: string | null
    originalAmount: number | null
    originalCurrency: string | null
    exchangeRate: number | null
    createdAt: string
  }>
}

export async function getExportData(
  userId: string,
  organizationId: string
): Promise<ExportData> {
  const [userRows, orgRows, accountRows, categoryRows, txRows] =
    await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          homeCurrency: users.homeCurrency,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1),
      db
        .select({
          id: accounts.id,
          name: accounts.name,
          type: accounts.type,
          currency: accounts.currency,
          initialBalance: accounts.initialBalance,
          createdAt: accounts.createdAt,
        })
        .from(accounts)
        .where(eq(accounts.organizationId, organizationId)),
      db
        .select({
          id: categories.id,
          name: categories.name,
          icon: categories.icon,
          parentId: categories.parentId,
          createdAt: categories.createdAt,
        })
        .from(categories)
        .where(eq(categories.organizationId, organizationId)),
      db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          note: transactions.note,
          date: transactions.date,
          settled: transactions.settled,
          accountId: transactions.accountId,
          categoryId: transactions.categoryId,
          originalAmount: transactions.originalAmount,
          originalCurrency: transactions.originalCurrency,
          exchangeRate: transactions.exchangeRate,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .where(eq(transactions.organizationId, organizationId)),
    ])

  const user = userRows[0]
  if (!user) throw new HTTPException(404, { message: "User not found" })

  return {
    exportedAt: new Date().toISOString(),
    user,
    organization: orgRows[0] ?? null,
    accounts: accountRows.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    categories: categoryRows.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    transactions: txRows.map((t) => ({
      ...t,
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
  }
}
