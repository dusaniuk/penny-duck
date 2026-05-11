import { z } from "zod"

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  homeCurrency: z.string(),
})

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  homeCurrency: z.string().length(3).optional(),
})

export const MemberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  joinedAt: z.string(),
})

export type Member = z.infer<typeof MemberSchema>

export const DeleteAccountSchema = z.object({
  email: z.email(),
})

export const MessageSchema = z.object({
  message: z.string(),
})

export const ExportAccountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.string(),
  currency: z.string(),
  initialBalance: z.number(),
  createdAt: z.string(),
})

export const ExportCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  icon: z.string().nullable(),
  parentId: z.uuid().nullable(),
  createdAt: z.string(),
})

export const ExportTransactionSchema = z.object({
  id: z.uuid(),
  amount: z.number(),
  note: z.string().nullable(),
  date: z.string(),
  settled: z.boolean(),
  accountId: z.uuid(),
  categoryId: z.uuid().nullable(),
  originalAmount: z.number().nullable(),
  originalCurrency: z.string().nullable(),
  exchangeRate: z.number().nullable(),
  createdAt: z.string(),
})

export const ExportDataSchema = z.object({
  exportedAt: z.string(),
  user: UserSchema,
  organization: z.object({
    id: z.uuid(),
    name: z.string(),
  }),
  accounts: z.array(ExportAccountSchema),
  categories: z.array(ExportCategorySchema),
  transactions: z.array(ExportTransactionSchema),
})

