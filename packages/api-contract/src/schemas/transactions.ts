import { initContract } from "@ts-rest/core"
import { z } from "zod"
import { MessageSchema, PaginatedResponseSchema } from "./common"

const c = initContract()

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  type: z.enum(["expense", "income"]),
  amount: z.number(),
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
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
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
})

export const UpdateTransferSchema = z.object({
  amount: z.number().min(0.01).optional(),
  date: z.string().datetime({ offset: true }).optional(),
  note: z.string().max(500).nullable().optional(),
  originalAmount: z.number().min(0.01).nullable().optional(),
  originalCurrency: z.string().max(3).nullable().optional(),
  exchangeRate: z.number().min(0.000001).nullable().optional(),
})

export const CreateReimbursementSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().min(0.01),
  date: z.string().datetime({ offset: true }),
  exchangeRate: z.number().min(0.000001).optional(),
})

export const TransferResponseSchema = z.object({
  outgoing: TransactionSchema,
  incoming: TransactionSchema,
})

export const transactionContract = c.router({
  create: {
    method: "POST",
    path: "/transactions",
    body: CreateTransactionSchema,
    responses: {
      201: TransactionSchema,
    },
  },
  list: {
    method: "GET",
    path: "/transactions",
    query: ListTransactionsQuerySchema,
    responses: {
      200: PaginatedResponseSchema(TransactionSchema),
    },
  },
  get: {
    method: "GET",
    path: "/transactions/:id",
    responses: {
      200: TransactionSchema,
    },
  },
  update: {
    method: "PATCH",
    path: "/transactions/:id",
    body: UpdateTransactionSchema,
    responses: {
      200: TransactionSchema,
    },
  },
  delete: {
    method: "DELETE",
    path: "/transactions/:id",
    body: c.noBody(),
    responses: {
      200: MessageSchema,
    },
  },
  settle: {
    method: "PATCH",
    path: "/transactions/:id/settle",
    body: c.noBody(),
    responses: {
      200: TransactionSchema,
    },
  },
  createReimbursement: {
    method: "POST",
    path: "/transactions/:id/reimburse",
    body: CreateReimbursementSchema,
    responses: {
      201: TransactionSchema,
    },
  },
  deleteReimbursement: {
    method: "DELETE",
    path: "/transactions/:id/reimburse/:reimbursementTransactionId",
    body: c.noBody(),
    responses: {
      200: MessageSchema,
    },
  },
  createTransfer: {
    method: "POST",
    path: "/transactions/transfers",
    body: CreateTransferSchema,
    responses: {
      201: TransferResponseSchema,
    },
  },
  updateTransfer: {
    method: "PATCH",
    path: "/transactions/transfers/:transferId",
    body: UpdateTransferSchema,
    responses: {
      200: TransferResponseSchema,
    },
  },
  deleteTransfer: {
    method: "DELETE",
    path: "/transactions/transfers/:transferId",
    body: c.noBody(),
    responses: {
      200: MessageSchema,
    },
  },
})
