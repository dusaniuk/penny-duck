import { randomUUID } from "node:crypto"
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
} from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import {
  accounts,
  organizationMembers,
  transactions,
  users,
} from "@workspace/db"
import { type Transaction } from "@workspace/api-contract"
import { db } from "@/db"
import { getRate } from "@/modules/exchange-rates/service"
import { findById as findAccountById } from "@/modules/accounts/service"

const DEFAULT_HOME_CURRENCY = "UAH"

type TransactionRow = typeof transactions.$inferSelect

interface TransactionRowWithUser extends TransactionRow {
  madeByName: string | null
}

const selectWithUser = {
  id: transactions.id,
  organizationId: transactions.organizationId,
  accountId: transactions.accountId,
  amount: transactions.amount,
  categoryId: transactions.categoryId,
  note: transactions.note,
  date: transactions.date,
  settled: transactions.settled,
  reimbursementId: transactions.reimbursementId,
  originalAmount: transactions.originalAmount,
  originalCurrency: transactions.originalCurrency,
  exchangeRate: transactions.exchangeRate,
  transferId: transactions.transferId,
  madeById: transactions.madeById,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
  madeByName: users.name,
} as const

function toResponse(
  row: TransactionRow | TransactionRowWithUser,
  homeAmount?: number,
): Transaction {
  const amount = Math.abs(row.amount)
  const madeByName = "madeByName" in row ? row.madeByName : null
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.amount < 0 ? "expense" : "income",
    amount,
    homeAmount: homeAmount ?? amount,
    categoryId: row.categoryId ?? null,
    note: row.note ?? null,
    date: row.date.toISOString(),
    settled: row.settled,
    originalAmount: row.originalAmount ?? null,
    originalCurrency: row.originalCurrency ?? null,
    exchangeRate: row.exchangeRate ?? null,
    transferId: row.transferId ?? null,
    reimbursementId: row.reimbursementId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    madeBy: row.madeById
      ? { id: row.madeById, name: madeByName ?? "Unknown" }
      : null,
  }
}

function validateExchangeRate(
  originalAmount?: number | null,
  originalCurrency?: string | null,
  exchangeRate?: number | null,
): void {
  const fields = [originalAmount, originalCurrency, exchangeRate]
  const provided = fields.filter((f) => f != null).length
  if (provided !== 0 && provided !== 3) {
    throw new HTTPException(400, {
      message: "Exchange rate fields must all be provided or all omitted",
    })
  }
}

async function getHomeCurrency(userId: string): Promise<string> {
  const rows = await db
    .select({ homeCurrency: users.homeCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return rows[0]?.homeCurrency ?? DEFAULT_HOME_CURRENCY
}

async function isMemberOfOrg(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

async function findById(
  id: string,
  organizationId: string,
): Promise<TransactionRow | null> {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.organizationId, organizationId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

async function findByIdWithUser(
  id: string,
  organizationId: string,
): Promise<TransactionRowWithUser | null> {
  const rows = await db
    .select(selectWithUser)
    .from(transactions)
    .leftJoin(users, eq(transactions.madeById, users.id))
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.organizationId, organizationId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

async function findByTransferId(
  transferId: string,
  organizationId: string,
): Promise<TransactionRow[]> {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.transferId, transferId),
        eq(transactions.organizationId, organizationId),
      ),
    )
}

interface InsertData {
  organizationId: string
  accountId: string
  amount: number
  categoryId: string | null
  note: string | null
  date: Date
  settled: boolean
  originalAmount: number | null
  originalCurrency: string | null
  exchangeRate: number | null
  transferId: string | null
  reimbursementId: string | null
  madeById: string | null
}

interface UpdateData {
  accountId?: string
  amount?: number
  categoryId?: string | null
  note?: string | null
  date?: Date
  settled?: boolean
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
  transferId?: string | null
  reimbursementId?: string | null
  madeById?: string | null
}

async function insertTransaction(data: InsertData): Promise<TransactionRow> {
  const [row] = await db.insert(transactions).values(data).returning()
  return row
}

async function updateTransactionRow(
  id: string,
  organizationId: string,
  data: UpdateData,
): Promise<TransactionRow> {
  const [row] = await db
    .update(transactions)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.organizationId, organizationId),
      ),
    )
    .returning()
  return row
}

async function insertTransferPair(
  outgoing: InsertData,
  incoming: InsertData,
): Promise<[TransactionRow, TransactionRow]> {
  return db.transaction(async (tx) => {
    const [outRow] = await tx
      .insert(transactions)
      .values(outgoing)
      .returning()
    const [inRow] = await tx.insert(transactions).values(incoming).returning()
    return [outRow, inRow]
  })
}

async function updateTransferPair(
  outgoingId: string,
  outgoingData: UpdateData,
  incomingId: string,
  incomingData: UpdateData,
  organizationId: string,
): Promise<[TransactionRow, TransactionRow]> {
  return db.transaction(async (tx) => {
    const [outRow] = await tx
      .update(transactions)
      .set({ ...outgoingData, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.id, outgoingId),
          eq(transactions.organizationId, organizationId),
        ),
      )
      .returning()
    const [inRow] = await tx
      .update(transactions)
      .set({ ...incomingData, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.id, incomingId),
          eq(transactions.organizationId, organizationId),
        ),
      )
      .returning()
    return [outRow, inRow]
  })
}

async function deleteByTransferId(
  transferId: string,
  organizationId: string,
): Promise<void> {
  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.transferId, transferId),
        eq(transactions.organizationId, organizationId),
      ),
    )
}

interface ListFilters {
  organizationId: string
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  uncategorized?: boolean
  transfer?: boolean
  dateFrom?: Date
  dateTo?: Date
  madeById?: string
  page: number
  limit: number
}

async function findAll(
  filters: ListFilters,
): Promise<{ data: TransactionRowWithUser[]; total: number }> {
  const conditions = [eq(transactions.organizationId, filters.organizationId)]

  if (filters.accountId)
    conditions.push(eq(transactions.accountId, filters.accountId))
  if (filters.type === "expense") conditions.push(lt(transactions.amount, 0))
  if (filters.type === "income") conditions.push(gt(transactions.amount, 0))
  if (filters.categoryId)
    conditions.push(eq(transactions.categoryId, filters.categoryId))
  if (filters.settled !== undefined)
    conditions.push(eq(transactions.settled, filters.settled))
  if (filters.uncategorized === true) {
    conditions.push(isNull(transactions.categoryId))
    conditions.push(isNull(transactions.transferId))
  }
  if (filters.accountId) {
    // Reimbursement transfers come as a sign-opposite pair: a negative
    // bookkeeping entry on the original expense account and a positive
    // entry on the receiving account. Only the receiving (positive) side
    // should ever appear in an account view.
    conditions.push(
      or(isNull(transactions.reimbursementId), gt(transactions.amount, 0))!,
    )
  } else {
    conditions.push(isNull(transactions.reimbursementId))
  }
  if (filters.transfer === true)
    conditions.push(isNotNull(transactions.transferId))
  if (filters.transfer === false)
    conditions.push(isNull(transactions.transferId))
  if (filters.dateFrom) conditions.push(gte(transactions.date, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(transactions.date, filters.dateTo))
  if (filters.madeById)
    conditions.push(eq(transactions.madeById, filters.madeById))

  // Brokerage accounts have their own home (the Investments page). Imported
  // IBKR deposits and any other brokerage-account rows shouldn't pollute the
  // cash-flow list. Hide them by default; show them only when the user
  // explicitly drills into a specific account.
  if (!filters.accountId) {
    conditions.push(ne(accounts.type, "brokerage"))
  }

  const where = and(...conditions)

  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(where)

  const offset = (filters.page - 1) * filters.limit
  const rows = await db
    .select(selectWithUser)
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(users, eq(transactions.madeById, users.id))
    .where(where)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(filters.limit)
    .offset(offset)

  const resultIds = new Set(rows.map((r) => r.id))
  const missingTransferIds = rows
    .filter(
      (r) =>
        r.transferId &&
        !r.reimbursementId &&
        !rows.some(
          (other) => other.transferId === r.transferId && other.id !== r.id,
        ),
    )
    .map((r) => r.transferId!)

  let pairedRows: typeof rows = []
  if (missingTransferIds.length > 0) {
    pairedRows = await db
      .select(selectWithUser)
      .from(transactions)
      .leftJoin(users, eq(transactions.madeById, users.id))
      .where(
        and(
          eq(transactions.organizationId, filters.organizationId),
          inArray(transactions.transferId, missingTransferIds),
        ),
      )
    pairedRows = pairedRows.filter((r) => !resultIds.has(r.id))
  }

  return { data: [...rows, ...pairedRows], total }
}

export interface CreateTransactionInput {
  organizationId: string
  accountId: string
  type: string
  amount: number
  categoryId: string | null
  date: Date
  note?: string | null
  settled?: boolean
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
  madeById: string
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  if (input.amount <= 0)
    throw new HTTPException(400, { message: "Amount must be greater than 0" })
  if (!input.categoryId) {
    throw new HTTPException(400, {
      message: "Category is required for expense and income transactions",
    })
  }
  validateExchangeRate(
    input.originalAmount,
    input.originalCurrency,
    input.exchangeRate,
  )

  const isMember = await isMemberOfOrg(input.madeById, input.organizationId)
  if (!isMember)
    throw new HTTPException(400, {
      message: "User is not a member of this organization",
    })

  const account = await findAccountById(
    input.accountId,
    input.organizationId,
    input.madeById,
  )
  if (!account)
    throw new HTTPException(404, { message: "Account not found" })

  const dbAmount = input.type === "expense" ? -input.amount : input.amount

  const row = await insertTransaction({
    organizationId: input.organizationId,
    accountId: input.accountId,
    amount: dbAmount,
    categoryId: input.categoryId ?? null,
    note: input.note ?? null,
    date: input.date,
    settled: input.settled ?? true,
    originalAmount: input.originalAmount ?? null,
    originalCurrency: input.originalCurrency ?? null,
    exchangeRate: input.exchangeRate ?? null,
    transferId: null,
    reimbursementId: null,
    madeById: input.madeById,
  })

  return toResponse(row)
}

export interface UpdateTransactionInput {
  accountId?: string
  amount?: number
  categoryId?: string | null
  note?: string | null
  date?: Date
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
  madeById?: string
}

export async function updateTransaction(
  id: string,
  organizationId: string,
  userId: string,
  fields: UpdateTransactionInput,
): Promise<Transaction> {
  const existing = await findById(id, organizationId)
  if (!existing)
    throw new HTTPException(404, { message: "Transaction not found" })
  if (existing.transferId)
    throw new HTTPException(400, {
      message: "Use the transfer endpoint to modify transfer transactions",
    })

  const updateData: UpdateData = {}

  if (fields.accountId !== undefined && fields.accountId !== existing.accountId) {
    const account = await findAccountById(
      fields.accountId,
      organizationId,
      userId,
    )
    if (!account)
      throw new HTTPException(404, { message: "Account not found" })
    updateData.accountId = fields.accountId
  }

  if (fields.amount !== undefined) {
    if (fields.amount <= 0)
      throw new HTTPException(400, { message: "Amount must be greater than 0" })
    updateData.amount = existing.amount < 0 ? -fields.amount : fields.amount
  }
  if (fields.categoryId !== undefined) {
    if (!existing.transferId && fields.categoryId === null) {
      throw new HTTPException(400, {
        message: "Category is required for expense and income transactions",
      })
    }
    updateData.categoryId = fields.categoryId
  }
  if (fields.note !== undefined) updateData.note = fields.note
  if (fields.date !== undefined) updateData.date = fields.date

  if (
    fields.originalAmount !== undefined &&
    fields.originalCurrency !== undefined &&
    fields.exchangeRate !== undefined
  ) {
    if (
      fields.originalAmount === null ||
      fields.originalCurrency === null ||
      fields.exchangeRate === null
    ) {
      updateData.originalAmount = null
      updateData.originalCurrency = null
      updateData.exchangeRate = null
    } else {
      validateExchangeRate(
        fields.originalAmount,
        fields.originalCurrency,
        fields.exchangeRate,
      )
      updateData.originalAmount = fields.originalAmount
      updateData.originalCurrency = fields.originalCurrency
      updateData.exchangeRate = fields.exchangeRate
    }
  }

  if (fields.madeById !== undefined) {
    const isMember = await isMemberOfOrg(fields.madeById, organizationId)
    if (!isMember)
      throw new HTTPException(400, {
        message: "User is not a member of this organization",
      })
    updateData.madeById = fields.madeById
  }

  const row = await updateTransactionRow(id, organizationId, updateData)
  return toResponse(row)
}

export async function deleteTransaction(
  id: string,
  organizationId: string,
): Promise<void> {
  const row = await findById(id, organizationId)
  if (!row) throw new HTTPException(404, { message: "Transaction not found" })
  if (row.transferId)
    throw new HTTPException(400, {
      message: "Use the transfer endpoint to modify transfer transactions",
    })

  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.organizationId, organizationId),
      ),
    )
}

export async function settleTransaction(
  id: string,
  organizationId: string,
): Promise<Transaction> {
  const row = await findById(id, organizationId)
  if (!row) throw new HTTPException(404, { message: "Transaction not found" })

  const updated = await updateTransactionRow(id, organizationId, {
    settled: !row.settled,
  })
  return toResponse(updated)
}

export async function getTransaction(
  id: string,
  organizationId: string,
): Promise<Transaction> {
  const row = await findByIdWithUser(id, organizationId)
  if (!row) throw new HTTPException(404, { message: "Transaction not found" })
  return toResponse(row)
}

export interface ListTransactionsInput {
  organizationId: string
  userId: string
  page: number
  limit: number
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  uncategorized?: boolean
  transfer?: boolean
  dateFrom?: Date
  dateTo?: Date
  madeById?: string
}

export async function listTransactions(
  input: ListTransactionsInput,
): Promise<{ data: Transaction[]; total: number; page: number; limit: number }> {
  const homeCurrency = await getHomeCurrency(input.userId)

  const { data, total } = await findAll({
    organizationId: input.organizationId,
    accountId: input.accountId,
    type: input.type,
    categoryId: input.categoryId,
    settled: input.settled,
    uncategorized: input.uncategorized,
    transfer: input.transfer,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    madeById: input.madeById,
    page: input.page,
    limit: input.limit,
  })

  if (data.length === 0) {
    return { data: [], total, page: input.page, limit: input.limit }
  }

  const accountRows = await db
    .select({ id: accounts.id, currency: accounts.currency })
    .from(accounts)
    .where(eq(accounts.organizationId, input.organizationId))

  const currencyByAccountId = new Map(
    accountRows.map((a) => [a.id, a.currency]),
  )
  const usedCurrencies = [...new Set(accountRows.map((a) => a.currency))]

  const results: Transaction[] = []
  for (const row of data) {
    const currency = currencyByAccountId.get(row.accountId)
    let homeAmount = Math.abs(row.amount)

    if (currency && currency !== homeCurrency) {
      const rate = await getRate(currency, homeCurrency, row.date, usedCurrencies)
      homeAmount = Math.abs(row.amount) * rate
    }

    results.push(toResponse(row, homeAmount))
  }

  return { data: results, total, page: input.page, limit: input.limit }
}

export interface CreateReimbursementInput {
  transactionId: string
  organizationId: string
  accountId: string
  amount: number
  date: Date
  exchangeRate?: number | null
  madeById: string
}

export async function createReimbursement(
  input: CreateReimbursementInput,
): Promise<Transaction> {
  if (input.amount <= 0)
    throw new HTTPException(400, { message: "Amount must be greater than 0" })

  const expense = await findById(input.transactionId, input.organizationId)
  if (!expense)
    throw new HTTPException(404, { message: "Transaction not found" })
  if (expense.amount >= 0)
    throw new HTTPException(400, { message: "Can only reimburse expenses" })

  const isMember = await isMemberOfOrg(input.madeById, input.organizationId)
  if (!isMember)
    throw new HTTPException(400, {
      message: "User is not a member of this organization",
    })

  const receivingAccount = await findAccountById(
    input.accountId,
    input.organizationId,
    input.madeById,
  )
  if (!receivingAccount)
    throw new HTTPException(404, { message: "Account not found" })

  const isSameAccount = input.accountId === expense.accountId

  let amountInExpenseCurrency: number
  let expenseAccountCurrency: string | null = null
  if (isSameAccount) {
    amountInExpenseCurrency = input.amount
  } else {
    const expenseAccount = await findAccountById(
      expense.accountId,
      input.organizationId,
      input.madeById,
    )
    if (!expenseAccount)
      throw new HTTPException(404, { message: "Account not found" })
    expenseAccountCurrency = expenseAccount.currency

    if (expenseAccount.currency === receivingAccount.currency) {
      amountInExpenseCurrency = input.amount
    } else {
      if (!input.exchangeRate)
        throw new HTTPException(400, {
          message: "Exchange rate is required for cross-currency reimbursements",
        })
      amountInExpenseCurrency = input.amount * input.exchangeRate
    }
  }

  amountInExpenseCurrency = Math.round(amountInExpenseCurrency * 100) / 100

  const currentExpenseAmount = Math.abs(expense.amount)
  if (amountInExpenseCurrency >= currentExpenseAmount)
    throw new HTTPException(400, {
      message: "Reimbursement exceeds remaining expense amount",
    })

  const newExpenseAmount = -(currentExpenseAmount - amountInExpenseCurrency)

  if (isSameAccount) {
    const updated = await updateTransactionRow(
      input.transactionId,
      input.organizationId,
      { amount: newExpenseAmount },
    )
    return toResponse(updated)
  }

  const transferId = randomUUID()
  const isCrossCurrency = expenseAccountCurrency !== receivingAccount.currency

  await insertTransferPair(
    {
      organizationId: input.organizationId,
      accountId: expense.accountId,
      amount: -amountInExpenseCurrency,
      categoryId: null,
      note: expense.note,
      date: input.date,
      settled: true,
      originalAmount: isCrossCurrency ? input.amount : null,
      originalCurrency: isCrossCurrency ? receivingAccount.currency : null,
      exchangeRate: isCrossCurrency ? input.exchangeRate! : null,
      transferId,
      reimbursementId: input.transactionId,
      madeById: input.madeById,
    },
    {
      organizationId: input.organizationId,
      accountId: input.accountId,
      amount: input.amount,
      categoryId: null,
      note: expense.note,
      date: input.date,
      settled: true,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      transferId,
      reimbursementId: input.transactionId,
      madeById: input.madeById,
    },
  )

  const updated = await updateTransactionRow(
    input.transactionId,
    input.organizationId,
    { amount: newExpenseAmount },
  )

  return toResponse(updated)
}

export async function deleteReimbursement(
  expenseId: string,
  reimbursementTransactionId: string,
  organizationId: string,
): Promise<void> {
  const expense = await findById(expenseId, organizationId)
  if (!expense)
    throw new HTTPException(404, { message: "Transaction not found" })

  const reimbursementTx = await findById(
    reimbursementTransactionId,
    organizationId,
  )
  if (!reimbursementTx || reimbursementTx.reimbursementId !== expenseId)
    throw new HTTPException(404, { message: "Reimbursement not found" })

  if (!reimbursementTx.transferId)
    throw new HTTPException(400, {
      message: "Same-account reimbursements cannot be individually deleted",
    })

  const pair = await findByTransferId(reimbursementTx.transferId, organizationId)
  const outgoing = pair.find((t) => t.amount < 0)
  if (!outgoing)
    throw new HTTPException(404, { message: "Transfer pair incomplete" })

  // Restore the expense amount: expense.amount is negative, outgoing.amount is negative
  // e.g. expense = -70, outgoing = -30 => restored = -70 + (-30) = -100
  const restoredAmount = expense.amount + outgoing.amount
  await updateTransactionRow(expenseId, organizationId, {
    amount: restoredAmount,
  })

  await deleteByTransferId(reimbursementTx.transferId, organizationId)
}

export interface CreateTransferInput {
  organizationId: string
  fromAccountId: string
  toAccountId: string
  amount: number
  date: Date
  note?: string | null
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
  madeById: string
}

export async function createTransfer(
  input: CreateTransferInput,
): Promise<[Transaction, Transaction]> {
  if (input.fromAccountId === input.toAccountId) {
    throw new HTTPException(400, {
      message: "Source and destination accounts must differ",
    })
  }
  if (input.amount <= 0)
    throw new HTTPException(400, { message: "Amount must be greater than 0" })
  validateExchangeRate(
    input.originalAmount,
    input.originalCurrency,
    input.exchangeRate,
  )

  const [fromAccount, toAccount] = await Promise.all([
    findAccountById(input.fromAccountId, input.organizationId, input.madeById),
    findAccountById(input.toAccountId, input.organizationId, input.madeById),
  ])
  if (!fromAccount || !toAccount)
    throw new HTTPException(404, { message: "Account not found" })

  const isMember = await isMemberOfOrg(input.madeById, input.organizationId)
  if (!isMember)
    throw new HTTPException(400, {
      message: "User is not a member of this organization",
    })

  const transferId = randomUUID()

  const hasExchangeRate =
    input.originalAmount != null &&
    input.originalCurrency != null &&
    input.exchangeRate != null

  const incomingAmount = hasExchangeRate ? input.originalAmount! : input.amount

  const [outRow, inRow] = await insertTransferPair(
    {
      organizationId: input.organizationId,
      accountId: input.fromAccountId,
      amount: -input.amount,
      categoryId: null,
      note: input.note ?? null,
      date: input.date,
      settled: true,
      originalAmount: input.originalAmount ?? null,
      originalCurrency: input.originalCurrency ?? null,
      exchangeRate: input.exchangeRate ?? null,
      transferId,
      reimbursementId: null,
      madeById: input.madeById,
    },
    {
      organizationId: input.organizationId,
      accountId: input.toAccountId,
      amount: incomingAmount,
      categoryId: null,
      note: input.note ?? null,
      date: input.date,
      settled: true,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      transferId,
      reimbursementId: null,
      madeById: input.madeById,
    },
  )

  return [toResponse(outRow), toResponse(inRow)]
}

export interface UpdateTransferInput {
  amount?: number
  date?: Date
  note?: string | null
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
  madeById?: string
}

export async function updateTransfer(
  transferId: string,
  organizationId: string,
  fields: UpdateTransferInput,
): Promise<[Transaction, Transaction]> {
  const pair = await findByTransferId(transferId, organizationId)
  if (pair.length !== 2)
    throw new HTTPException(404, { message: "Transaction not found" })

  const outgoing = pair.find((t) => t.amount < 0)!
  const incoming = pair.find((t) => t.amount > 0)!

  const outgoingUpdate: UpdateData = {}
  const incomingUpdate: UpdateData = {}

  if (fields.note !== undefined) {
    outgoingUpdate.note = fields.note
    incomingUpdate.note = fields.note
  }
  if (fields.date !== undefined) {
    outgoingUpdate.date = fields.date
    incomingUpdate.date = fields.date
  }
  if (fields.madeById !== undefined) {
    const isMember = await isMemberOfOrg(fields.madeById, organizationId)
    if (!isMember)
      throw new HTTPException(400, {
        message: "User is not a member of this organization",
      })
    outgoingUpdate.madeById = fields.madeById
    incomingUpdate.madeById = fields.madeById
  }

  const hasNewExchangeRate =
    fields.originalAmount != null &&
    fields.originalCurrency != null &&
    fields.exchangeRate != null

  if (fields.amount !== undefined) {
    if (fields.amount <= 0)
      throw new HTTPException(400, { message: "Amount must be greater than 0" })
    outgoingUpdate.amount = -fields.amount
    if (hasNewExchangeRate) {
      incomingUpdate.amount = fields.originalAmount!
    } else {
      incomingUpdate.amount = fields.amount
    }
  }

  if (
    fields.originalAmount !== undefined &&
    fields.originalCurrency !== undefined &&
    fields.exchangeRate !== undefined
  ) {
    if (
      fields.originalAmount === null ||
      fields.originalCurrency === null ||
      fields.exchangeRate === null
    ) {
      outgoingUpdate.originalAmount = null
      outgoingUpdate.originalCurrency = null
      outgoingUpdate.exchangeRate = null
    } else {
      validateExchangeRate(
        fields.originalAmount,
        fields.originalCurrency,
        fields.exchangeRate,
      )
      outgoingUpdate.originalAmount = fields.originalAmount
      outgoingUpdate.originalCurrency = fields.originalCurrency
      outgoingUpdate.exchangeRate = fields.exchangeRate
      if (fields.amount === undefined) {
        incomingUpdate.amount = fields.originalAmount
      }
    }
  }

  const [outRow, inRow] = await updateTransferPair(
    outgoing.id,
    outgoingUpdate,
    incoming.id,
    incomingUpdate,
    organizationId,
  )

  return [toResponse(outRow), toResponse(inRow)]
}

export async function deleteTransfer(
  transferId: string,
  organizationId: string,
): Promise<void> {
  const pair = await findByTransferId(transferId, organizationId)
  if (pair.length !== 2)
    throw new HTTPException(404, { message: "Transaction not found" })

  await deleteByTransferId(transferId, organizationId)
}
