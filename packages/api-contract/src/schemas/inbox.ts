import { z } from "zod"

export const InboxItemSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  card: z.string(),
  merchant: z.string().nullable(),
  description: z.string().nullable(),
  amount: z.number(),
  currency: z.string().nullable(),
  occurredAt: z.string(),
  accountId: z.uuid().nullable(),
  transactionId: z.uuid().nullable(),
  createdAt: z.string(),
})

export const WalletIngestSchema = z.object({
  card: z.string().trim().min(1).max(100),
  amount: z.union([z.number(), z.string().trim().min(1).max(40)]),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || v.length === 3, {
      message: "Currency must be a 3-letter code",
    }),
  merchant: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined)),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
})

export const ListInboxQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const AcceptInboxItemSchema = z.object({
  accountId: z.uuid(),
  categoryId: z.uuid(),
  saveCardLabel: z.boolean().optional(),
})

export type InboxItem = z.infer<typeof InboxItemSchema>
