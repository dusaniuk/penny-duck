import { and, asc, count, eq, sql, sum } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import {
  accounts,
  organizationMembers,
  trades,
  transactions,
  users,
} from "@workspace/db"
import { type Account } from "@workspace/api-contract"
import { db } from "@/db"
import { getRate } from "@/modules/exchange-rates/service"
import { countOpenPositionsFromTrades } from "@/modules/investments/helpers/count-open-positions"

export type AccountRow = typeof accounts.$inferSelect & {
  balance: number
  isDefault: boolean
}

const DEFAULT_HOME_CURRENCY = "UAH"

function balanceSubquery() {
  return db
    .select({
      accountId: transactions.accountId,
      total: sum(transactions.amount).as("tx_total"),
    })
    .from(transactions)
    .groupBy(transactions.accountId)
    .as("balance_sq")
}

// Trades hold their own cash impact directly: buy = -amount, sell = +amount,
// dividend = +amount + withheld_tax (both stored in cents).
function tradesCashSubquery() {
  return db
    .select({
      accountId: trades.accountId,
      total: sql<string>`sum(case
        when ${trades.type} = 'buy' then -${trades.amount}
        when ${trades.type} = 'sell' then ${trades.amount}
        when ${trades.type} = 'dividend' then ${trades.amount} + coalesce(${trades.withheldTax}, 0)
        else 0
      end)`.as("trades_total"),
    })
    .from(trades)
    .groupBy(trades.accountId)
    .as("trades_cash_sq")
}

function selectAccountRow(userId: string) {
  const balanceSq = balanceSubquery()
  const tradesSq = tradesCashSubquery()
  const baseSelect = db
    .select({
      id: accounts.id,
      organizationId: accounts.organizationId,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
      initialBalance: accounts.initialBalance,
      externalAccountId: accounts.externalAccountId,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      balance: sql<number>`(${accounts.initialBalance} + coalesce(${balanceSq.total}, 0) + coalesce(${tradesSq.total}, 0))::float / 100`,
      isDefault: sql<boolean>`coalesce(${organizationMembers.defaultAccountId} = ${accounts.id}, false)`,
    })
    .from(accounts)
    .leftJoin(balanceSq, eq(balanceSq.accountId, accounts.id))
    .leftJoin(tradesSq, eq(tradesSq.accountId, accounts.id))
    .leftJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, accounts.organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
  return baseSelect
}

export async function findAllByOrganizationId(
  organizationId: string,
  userId: string,
): Promise<AccountRow[]> {
  return selectAccountRow(userId)
    .where(eq(accounts.organizationId, organizationId))
    .orderBy(asc(accounts.name))
}

export async function findById(
  id: string,
  organizationId: string,
  userId: string,
): Promise<AccountRow | null> {
  const rows = await selectAccountRow(userId)
    .where(
      and(eq(accounts.id, id), eq(accounts.organizationId, organizationId)),
    )
    .limit(1)
  return rows[0] ?? null
}

async function getHomeCurrency(userId: string): Promise<string> {
  const rows = await db
    .select({ homeCurrency: users.homeCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return rows[0]?.homeCurrency ?? DEFAULT_HOME_CURRENCY
}

function toResponse(row: AccountRow, rate: number): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    balance: row.balance,
    homeBalance: row.balance * rate,
    isDefault: row.isDefault,
  }
}

export async function listAccounts(
  organizationId: string,
  userId: string,
): Promise<Account[]> {
  const [rows, homeCurrency] = await Promise.all([
    findAllByOrganizationId(organizationId, userId),
    getHomeCurrency(userId),
  ])

  const today = new Date()
  const currencies = [...new Set(rows.map((r) => r.currency))]
  const rates = new Map<string, number>()
  await Promise.all(
    currencies.map(async (currency) => {
      const rate = await getRate(currency, homeCurrency, today, currencies)
      rates.set(currency, rate)
    }),
  )

  return rows.map((r) => toResponse(r, rates.get(r.currency) ?? 1))
}

export async function getAccount(
  id: string,
  organizationId: string,
  userId: string,
): Promise<Account> {
  const [row, homeCurrency] = await Promise.all([
    findById(id, organizationId, userId),
    getHomeCurrency(userId),
  ])
  if (!row) throw new HTTPException(404, { message: "Account not found" })

  const rate = await getRate(row.currency, homeCurrency, new Date())
  return toResponse(row, rate)
}

export interface CreateAccountInput {
  organizationId: string
  userId: string
  name: string
  type: string
  currency: string
  balance?: number
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const [inserted] = await db
    .insert(accounts)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      type: input.type,
      currency: input.currency,
      initialBalance: input.balance ?? 0,
    })
    .returning()

  const homeCurrency = await getHomeCurrency(input.userId)
  const rate = await getRate(inserted.currency, homeCurrency, new Date())

  const row: AccountRow = {
    ...inserted,
    balance: inserted.initialBalance,
    isDefault: false,
  }
  return toResponse(row, rate)
}

export interface UpdateAccountInput {
  id: string
  organizationId: string
  userId: string
  name?: string
  type?: string
}

export async function updateAccount(input: UpdateAccountInput): Promise<Account> {
  const existing = await findById(input.id, input.organizationId, input.userId)
  if (!existing) throw new HTTPException(404, { message: "Account not found" })

  await db
    .update(accounts)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(accounts.id, input.id),
        eq(accounts.organizationId, input.organizationId),
      ),
    )

  const [row, homeCurrency] = await Promise.all([
    findById(input.id, input.organizationId, input.userId),
    getHomeCurrency(input.userId),
  ])
  if (!row) throw new HTTPException(404, { message: "Account not found" })

  const rate = await getRate(row.currency, homeCurrency, new Date())
  return toResponse(row, rate)
}

export async function deleteAccount(
  id: string,
  organizationId: string,
  userId: string,
): Promise<void> {
  const account = await findById(id, organizationId, userId)
  if (!account) throw new HTTPException(404, { message: "Account not found" })

  const tradeRows = await db
    .select()
    .from(trades)
    .where(eq(trades.accountId, id))
    .orderBy(asc(trades.date), asc(trades.createdAt))
  const openCount = countOpenPositionsFromTrades(
    tradeRows.map((t) => ({
      instrumentId: t.instrumentId,
      type: t.type as "buy" | "sell" | "dividend",
      quantity: t.quantity,
      price: t.price,
      fees: t.fees,
      date: t.date,
      createdAt: t.createdAt,
    })),
  )
  if (openCount > 0) {
    throw new HTTPException(409, {
      message: `Account has ${openCount} position${openCount !== 1 ? "s" : ""} and cannot be deleted`,
    })
  }

  const [{ value: txCount }] = await db
    .select({ value: count() })
    .from(transactions)
    .where(eq(transactions.accountId, id))
  if (txCount > 0) {
    throw new HTTPException(409, {
      message: `Account has ${txCount} transaction${txCount !== 1 ? "s" : ""} and cannot be deleted`,
    })
  }

  await db
    .delete(accounts)
    .where(
      and(eq(accounts.id, id), eq(accounts.organizationId, organizationId)),
    )
}

export async function setDefaultAccount(
  userId: string,
  organizationId: string,
  accountId: string,
): Promise<Account> {
  const existing = await findById(accountId, organizationId, userId)
  if (!existing) throw new HTTPException(404, { message: "Account not found" })

  await db
    .update(organizationMembers)
    .set({ defaultAccountId: accountId })
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )

  const [row, homeCurrency] = await Promise.all([
    findById(accountId, organizationId, userId),
    getHomeCurrency(userId),
  ])
  const rate = await getRate(row!.currency, homeCurrency, new Date())
  return toResponse(row!, rate)
}

export async function clearDefaultAccount(
  userId: string,
  organizationId: string,
): Promise<void> {
  await db
    .update(organizationMembers)
    .set({ defaultAccountId: null })
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
}
