import { and, asc, count, eq, inArray, sql, sum } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import {
  accounts,
  organizationMembers,
  trades,
  transactions,
  users,
} from "@workspace/db"
import { type Account, type AccountUsageItem } from "@workspace/api-contract"
import { db } from "@/db"
import { getRate } from "@/modules/exchange-rates/service"
import { countOpenPositionsFromTrades } from "@/modules/investments/helpers/count-open-positions"
import {
  findInstrumentsByIds,
  refreshIfStale,
} from "@/modules/investments/instruments/service"
import {
  replayPosition,
  type ReplayTrade,
} from "@/modules/investments/helpers/replay-position"

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
      color: accounts.color,
      icon: accounts.icon,
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

function toResponse(row: AccountRow, rate: number, holdings = 0): Account {
  const total = row.balance + holdings
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    color: row.color,
    icon: row.icon,
    balance: total,
    homeBalance: total * rate,
    isDefault: row.isDefault,
  }
}

// For brokerage accounts, value all open positions at current price and convert
// to the account's own currency. Returned map's value is in account-currency
// units; non-brokerage accounts should not be passed in.
async function computeBrokerageHoldingsByAccount(
  brokerageAccounts: Array<{ id: string; currency: string }>,
): Promise<Map<string, number>> {
  if (brokerageAccounts.length === 0) return new Map()

  const accountIds = brokerageAccounts.map((a) => a.id)
  const allTrades = await db
    .select()
    .from(trades)
    .where(inArray(trades.accountId, accountIds))
  if (allTrades.length === 0) return new Map()

  const groups = new Map<
    string,
    { accountId: string; instrumentId: string; trades: ReplayTrade[] }
  >()
  for (const t of allTrades) {
    const key = `${t.accountId}:${t.instrumentId}`
    const replayTrade: ReplayTrade = {
      type: t.type as ReplayTrade["type"],
      quantity: t.quantity,
      price: t.price,
      fees: t.fees,
      date: t.date,
      createdAt: t.createdAt,
    }
    const existing = groups.get(key)
    if (existing) existing.trades.push(replayTrade)
    else
      groups.set(key, {
        accountId: t.accountId,
        instrumentId: t.instrumentId,
        trades: [replayTrade],
      })
  }

  const instrumentIds = [...new Set(allTrades.map((t) => t.instrumentId))]
  const instrumentRows = await findInstrumentsByIds(instrumentIds)
  const { refreshed } = await refreshIfStale(instrumentRows)
  const byInstrumentId = new Map(refreshed.map((r) => [r.id, r]))
  const byAccountId = new Map(brokerageAccounts.map((a) => [a.id, a]))

  const today = new Date()
  const rateCache = new Map<string, number>()
  async function rateFor(from: string, to: string): Promise<number> {
    if (from === to) return 1
    const key = `${from}->${to}`
    const cached = rateCache.get(key)
    if (cached !== undefined) return cached
    const r = await getRate(from, to, today)
    rateCache.set(key, r)
    return r
  }

  const holdings = new Map<string, number>()
  for (const group of groups.values()) {
    const state = replayPosition(group.trades)
    if (state.quantity <= 0) continue
    const inst = byInstrumentId.get(group.instrumentId)
    if (!inst) continue
    const account = byAccountId.get(group.accountId)
    if (!account) continue
    const valueInstrumentCcy = state.quantity * inst.lastPrice
    const fx = await rateFor(inst.currency, account.currency)
    const valueAccountCcy = valueInstrumentCcy * fx
    holdings.set(
      group.accountId,
      (holdings.get(group.accountId) ?? 0) + valueAccountCcy,
    )
  }

  return holdings
}

export async function listAccounts(
  organizationId: string,
  userId: string,
): Promise<Account[]> {
  const [rows, homeCurrency] = await Promise.all([
    findAllByOrganizationId(organizationId, userId),
    getHomeCurrency(userId),
  ])

  const brokerageAccounts = rows.filter((r) => r.type === "brokerage")
  const holdingsByAccount =
    await computeBrokerageHoldingsByAccount(brokerageAccounts)

  const today = new Date()
  const currencies = [...new Set(rows.map((r) => r.currency))]
  const rates = new Map<string, number>()
  await Promise.all(
    currencies.map(async (currency) => {
      const rate = await getRate(currency, homeCurrency, today, currencies)
      rates.set(currency, rate)
    }),
  )

  return rows.map((r) =>
    toResponse(r, rates.get(r.currency) ?? 1, holdingsByAccount.get(r.id) ?? 0),
  )
}

// Count of transactions per account, scoped to the org. Used by the
// transaction-form account chips to surface the most-used accounts first.
// Includes both regular transactions and transfer legs (both write rows
// with accountId set).
export async function getAccountUsage(
  organizationId: string,
): Promise<AccountUsageItem[]> {
  const rows = await db
    .select({
      accountId: transactions.accountId,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(eq(transactions.organizationId, organizationId))
    .groupBy(transactions.accountId)

  return rows.map((r) => ({ accountId: r.accountId, count: r.count }))
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
  const holdings =
    row.type === "brokerage"
      ? ((await computeBrokerageHoldingsByAccount([row])).get(row.id) ?? 0)
      : 0
  return toResponse(row, rate, holdings)
}

export interface CreateAccountInput {
  organizationId: string
  userId: string
  name: string
  type: string
  currency: string
  color?: string
  icon?: string
  balance?: number
  isDefault?: boolean
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(accounts)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        type: input.type,
        currency: input.currency,
        color: input.color ?? null,
        icon: input.icon ?? null,
        initialBalance: input.balance ?? 0,
      })
      .returning()

    if (input.isDefault) {
      await tx
        .update(organizationMembers)
        .set({ defaultAccountId: row.id })
        .where(
          and(
            eq(organizationMembers.userId, input.userId),
            eq(organizationMembers.organizationId, input.organizationId),
          ),
        )
    }

    return row
  })

  const homeCurrency = await getHomeCurrency(input.userId)
  const rate = await getRate(inserted.currency, homeCurrency, new Date())

  const row: AccountRow = {
    ...inserted,
    balance: inserted.initialBalance,
    isDefault: input.isDefault === true,
  }
  return toResponse(row, rate)
}

export interface UpdateAccountInput {
  id: string
  organizationId: string
  userId: string
  name?: string
  type?: string
  color?: string
  icon?: string
  isDefault?: boolean
}

export async function updateAccount(input: UpdateAccountInput): Promise<Account> {
  const existing = await findById(input.id, input.organizationId, input.userId)
  if (!existing) throw new HTTPException(404, { message: "Account not found" })

  await db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accounts.id, input.id),
          eq(accounts.organizationId, input.organizationId),
        ),
      )

    if (input.isDefault) {
      await tx
        .update(organizationMembers)
        .set({ defaultAccountId: input.id })
        .where(
          and(
            eq(organizationMembers.userId, input.userId),
            eq(organizationMembers.organizationId, input.organizationId),
          ),
        )
    }
  })

  const [row, homeCurrency] = await Promise.all([
    findById(input.id, input.organizationId, input.userId),
    getHomeCurrency(input.userId),
  ])
  if (!row) throw new HTTPException(404, { message: "Account not found" })

  const rate = await getRate(row.currency, homeCurrency, new Date())
  const holdings =
    row.type === "brokerage"
      ? ((await computeBrokerageHoldingsByAccount([row])).get(row.id) ?? 0)
      : 0
  return toResponse(row, rate, holdings)
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
  const holdings =
    row!.type === "brokerage"
      ? ((await computeBrokerageHoldingsByAccount([row!])).get(row!.id) ?? 0)
      : 0
  return toResponse(row!, rate, holdings)
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
