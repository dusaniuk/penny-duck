import { initContract } from "@ts-rest/core"
import { z } from "zod"

const c = initContract()

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  homeCurrency: z.string(),
})

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  homeCurrency: z.string().length(3).optional(),
})

export const MemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  joinedAt: z.string(),
})

export type Member = z.infer<typeof MemberSchema>

export const DeleteAccountSchema = z.object({
  email: z.string().email(),
})

export const MessageSchema = z.object({
  message: z.string(),
})

export const ExportAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  currency: z.string(),
  initialBalance: z.number(),
  createdAt: z.string(),
})

export const ExportCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  icon: z.string().nullable(),
  parentId: z.string().uuid().nullable(),
  createdAt: z.string(),
})

export const ExportTransactionSchema = z.object({
  id: z.string().uuid(),
  amount: z.number(),
  note: z.string().nullable(),
  date: z.string(),
  settled: z.boolean(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  originalAmount: z.number().nullable(),
  originalCurrency: z.string().nullable(),
  exchangeRate: z.number().nullable(),
  createdAt: z.string(),
})

export const ExportDataSchema = z.object({
  exportedAt: z.string(),
  user: UserSchema,
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  accounts: z.array(ExportAccountSchema),
  categories: z.array(ExportCategorySchema),
  transactions: z.array(ExportTransactionSchema),
})

export const userContract = c.router({
  getMe: {
    method: "GET",
    path: "/users/me",
    responses: {
      200: UserSchema,
    },
  },
  updateMe: {
    method: "PATCH",
    path: "/users/me",
    body: UpdateProfileSchema,
    responses: {
      200: UserSchema,
    },
  },
  deleteMe: {
    method: "DELETE",
    path: "/users/me",
    body: DeleteAccountSchema,
    responses: {
      200: MessageSchema,
    },
  },
  exportData: {
    method: "GET",
    path: "/users/me/export",
    responses: {
      200: ExportDataSchema,
    },
  },
  getMembers: {
    method: "GET",
    path: "/users/members",
    responses: {
      200: z.array(MemberSchema),
    },
  },
})
