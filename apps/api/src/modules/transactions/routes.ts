import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import {
  CreateReimbursementSchema,
  CreateTransactionSchema,
  CreateTransferSchema,
  ListTransactionsQuerySchema,
  UpdateTransactionSchema,
  UpdateTransferSchema,
} from "@workspace/api-contract"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import {
  createReimbursement,
  createTransaction,
  createTransfer,
  deleteReimbursement,
  deleteTransaction,
  deleteTransfer,
  getTransaction,
  listTransactions,
  settleTransaction,
  updateTransaction,
  updateTransfer,
} from "./service"

const IdParamSchema = z.object({ id: z.uuid() })
const TransferIdParamSchema = z.object({ transferId: z.uuid() })
const ReimbursementParamSchema = z.object({
  id: z.uuid(),
  reimbursementTransactionId: z.uuid(),
})

export const transactionsRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .post(
    "/transfers",
    zValidator("json", CreateTransferSchema),
    async (c) => {
      const user = c.get("user")
      const body = c.req.valid("json")
      const [outgoing, incoming] = await createTransfer({
        organizationId: user.organizationId,
        fromAccountId: body.fromAccountId,
        toAccountId: body.toAccountId,
        amount: body.amount,
        date: new Date(body.date),
        note: body.note,
        originalAmount: body.originalAmount,
        originalCurrency: body.originalCurrency,
        exchangeRate: body.exchangeRate,
        madeById: body.madeById ?? user.sub,
      })
      return c.json({ outgoing, incoming }, 201)
    },
  )
  .patch(
    "/transfers/:transferId",
    zValidator("param", TransferIdParamSchema),
    zValidator("json", UpdateTransferSchema),
    async (c) => {
      const user = c.get("user")
      const { transferId } = c.req.valid("param")
      const body = c.req.valid("json")
      const [outgoing, incoming] = await updateTransfer(
        transferId,
        user.organizationId,
        {
          amount: body.amount,
          date: body.date ? new Date(body.date) : undefined,
          note: body.note,
          originalAmount: body.originalAmount,
          originalCurrency: body.originalCurrency,
          exchangeRate: body.exchangeRate,
          madeById: body.madeById,
        },
      )
      return c.json({ outgoing, incoming })
    },
  )
  .delete(
    "/transfers/:transferId",
    zValidator("param", TransferIdParamSchema),
    async (c) => {
      const user = c.get("user")
      const { transferId } = c.req.valid("param")
      await deleteTransfer(transferId, user.organizationId)
      return c.json({ message: "Transfer deleted" })
    },
  )
  .get(
    "/",
    zValidator("query", ListTransactionsQuerySchema),
    async (c) => {
      const user = c.get("user")
      const query = c.req.valid("query")
      const result = await listTransactions({
        organizationId: user.organizationId,
        userId: user.sub,
        page: query.page ?? 1,
        limit: query.limit ?? 50,
        accountId: query.accountId,
        type: query.type,
        categoryId: query.categoryId,
        settled: query.settled,
        uncategorized: query.uncategorized,
        transfer: query.transfer,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        madeById: query.madeById,
      })
      return c.json(result)
    },
  )
  .post("/", zValidator("json", CreateTransactionSchema), async (c) => {
    const user = c.get("user")
    const body = c.req.valid("json")
    const transaction = await createTransaction({
      organizationId: user.organizationId,
      accountId: body.accountId,
      type: body.type,
      amount: body.amount,
      categoryId: body.categoryId,
      date: new Date(body.date),
      note: body.note,
      settled: body.settled,
      originalAmount: body.originalAmount,
      originalCurrency: body.originalCurrency,
      exchangeRate: body.exchangeRate,
      madeById: body.madeById ?? user.sub,
    })
    return c.json(transaction, 201)
  })
  .post(
    "/:id/reimburse",
    zValidator("param", IdParamSchema),
    zValidator("json", CreateReimbursementSchema),
    async (c) => {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const transaction = await createReimbursement({
        transactionId: id,
        organizationId: user.organizationId,
        accountId: body.accountId,
        amount: body.amount,
        date: new Date(body.date),
        exchangeRate: body.exchangeRate,
        madeById: body.madeById ?? user.sub,
      })
      return c.json(transaction, 201)
    },
  )
  .delete(
    "/:id/reimburse/:reimbursementTransactionId",
    zValidator("param", ReimbursementParamSchema),
    async (c) => {
      const user = c.get("user")
      const { id, reimbursementTransactionId } = c.req.valid("param")
      await deleteReimbursement(
        id,
        reimbursementTransactionId,
        user.organizationId,
      )
      return c.json({ message: "Reimbursement deleted" })
    },
  )
  .patch(
    "/:id/settle",
    zValidator("param", IdParamSchema),
    async (c) => {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const transaction = await settleTransaction(id, user.organizationId)
      return c.json(transaction)
    },
  )
  .get("/:id", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    const { id } = c.req.valid("param")
    const transaction = await getTransaction(id, user.organizationId)
    return c.json(transaction)
  })
  .patch(
    "/:id",
    zValidator("param", IdParamSchema),
    zValidator("json", UpdateTransactionSchema),
    async (c) => {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const transaction = await updateTransaction(id, user.organizationId, user.sub, {
        accountId: body.accountId,
        amount: body.amount,
        categoryId: body.categoryId,
        note: body.note,
        date: body.date ? new Date(body.date) : undefined,
        originalAmount: body.originalAmount,
        originalCurrency: body.originalCurrency,
        exchangeRate: body.exchangeRate,
        madeById: body.madeById,
      })
      return c.json(transaction)
    },
  )
  .delete("/:id", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    const { id } = c.req.valid("param")
    await deleteTransaction(id, user.organizationId)
    return c.json({ message: "Transaction deleted" })
  })
