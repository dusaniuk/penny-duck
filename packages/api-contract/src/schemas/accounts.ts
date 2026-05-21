import { z } from "zod"

export const AccountColorSchema = z.string().trim().min(1).max(20)
export const AccountIconSchema = z.string().trim().min(1).max(50)

export const AccountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.string(),
  currency: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  balance: z.number(),
  homeBalance: z.number(),
  isDefault: z.boolean(),
})

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1),
  currency: z.string().length(3),
  color: AccountColorSchema.optional(),
  icon: AccountIconSchema.optional(),
  balance: z.number().optional(),
})

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.string().min(1).optional(),
  color: AccountColorSchema.optional(),
  icon: AccountIconSchema.optional(),
})

export const AccountUsageItemSchema = z.object({
  accountId: z.uuid(),
  count: z.number().int().nonnegative(),
})

export const AccountUsageResponseSchema = z.array(AccountUsageItemSchema)

export type Account = z.infer<typeof AccountSchema>
export type AccountUsageItem = z.infer<typeof AccountUsageItemSchema>
