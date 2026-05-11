import { z } from "zod"

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  type: z.enum(["expense", "income"]),
  amount: z.number(),
  homeAmount: z.number(),
  categoryId: z.string().uuid().nullable(),
  note: z.string().nullable(),
  date: z.string(),
  settled: z.boolean(),
  originalAmount: z.number().nullable(),
  originalCurrency: z.string().nullable(),
  exchangeRate: z.number().nullable(),
  transferId: z.string().uuid().nullable(),
  reimbursementId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  madeBy: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable(),
})

export type Transaction = z.infer<typeof TransactionSchema>

export const CreateTransactionSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["expense", "income"]),
  amount: z.number().min(0.01),
  categoryId: z.string().uuid(),
  date: z.string().datetime({ offset: true }),
  note: z.string().max(500).optional(),
  settled: z.boolean().optional(),
  originalAmount: z.number().min(0.01).optional(),
  originalCurrency: z.string().max(3).optional(),
  exchangeRate: z.number().min(0.000001).optional(),
  madeById: z.string().uuid().optional(),
})

export const UpdateTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  amount: z.number().min(0.01).optional(),
  categoryId: z.string().uuid().optional(),
  note: z.string().max(500).nullable().optional(),
  date: z.string().datetime({ offset: true }).optional(),
  originalAmount: z.number().min(0.01).nullable().optional(),
  originalCurrency: z.string().max(3).nullable().optional(),
  exchangeRate: z.number().min(0.000001).nullable().optional(),
  madeById: z.string().uuid().optional(),
})

export const ListTransactionsQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  type: z.enum(["expense", "income"]).optional(),
  transfer: z
    .preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean())
    .optional(),
  categoryId: z.string().uuid().optional(),
  settled: z
    .preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean())
    .optional(),
  uncategorized: z
    .preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean())
    .optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  madeById: z.string().uuid().optional(),
})

export const CreateTransferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.number().min(0.01),
  date: z.string().datetime({ offset: true }),
  note: z.string().max(500).optional(),
  originalAmount: z.number().min(0.01).optional(),
  originalCurrency: z.string().max(3).optional(),
  exchangeRate: z.number().min(0.000001).optional(),
  madeById: z.string().uuid().optional(),
})

export const UpdateTransferSchema = z.object({
  amount: z.number().min(0.01).optional(),
  date: z.string().datetime({ offset: true }).optional(),
  note: z.string().max(500).nullable().optional(),
  originalAmount: z.number().min(0.01).nullable().optional(),
  originalCurrency: z.string().max(3).nullable().optional(),
  exchangeRate: z.number().min(0.000001).nullable().optional(),
  madeById: z.string().uuid().optional(),
})

export const CreateReimbursementSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().min(0.01),
  date: z.string().datetime({ offset: true }),
  exchangeRate: z.number().min(0.000001).optional(),
  madeById: z.string().uuid().optional(),
})

export const TransferResponseSchema = z.object({
  outgoing: TransactionSchema,
  incoming: TransactionSchema,
})
