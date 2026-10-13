import { z } from "zod"

export const AccountColorSchema = z.string().trim().min(1).max(20)
export const AccountIconSchema = z.string().trim().min(1).max(50)
export const AccountCardLabelSchema = z.string().trim().min(1).max(100)

// A leaf account (bank/brokerage), and also the synthesized representation of a
// wallet pocket on the client (type "wallet", walletId set). `type` stays a
// loose string because of that reuse.
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
  walletId: z.uuid().nullable(),
  cardLabel: z.string().nullable(),
})

export const WalletPocketSchema = z.object({
  accountId: z.uuid(),
  currency: z.string().length(3),
  balance: z.number(),
  homeBalance: z.number(),
})

// A wallet is an account that holds multiple single-currency pockets. It has no
// single currency/balance of its own — only a home-currency total and pockets.
export const WalletSchema = z.object({
  id: z.uuid(),
  type: z.literal("wallet"),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  totalHomeBalance: z.number(),
  pockets: z.array(WalletPocketSchema),
})

// GET /accounts returns a flat list of accounts. A wallet entry carries its
// pockets; everything else is a leaf. Discriminate with `"pockets" in account`
// (or the isWallet helper on the client) — the two shapes are disjoint.
export const AccountListItemSchema = z.union([WalletSchema, AccountSchema])
export const AccountsResponseSchema = z.array(AccountListItemSchema)

export const CreatePocketInputSchema = z.object({
  currency: z.string().length(3),
  balance: z.number(),
})

export const CreateStandaloneAccountSchema = z.object({
  type: z.enum(["bank", "brokerage", "loan"]),
  name: z.string().min(1).max(100),
  currency: z.string().length(3),
  color: AccountColorSchema.optional(),
  icon: AccountIconSchema.optional(),
  balance: z.number().optional(),
  isDefault: z.boolean().optional(),
  cardLabel: AccountCardLabelSchema.optional(),
})

export const CreateWalletAccountSchema = z.object({
  type: z.literal("wallet"),
  name: z.string().min(1).max(100),
  color: AccountColorSchema.optional(),
  icon: AccountIconSchema.optional(),
  pockets: z.array(CreatePocketInputSchema),
})

// POST /accounts accepts either a leaf account or a wallet. The two variants are
// disjoint on `type`, so a payload that is neither (e.g. an unknown type, or a
// wallet missing its pockets) is rejected — no orphaned standalone rows.
export const CreateAccountSchema = z.union([
  CreateWalletAccountSchema,
  CreateStandaloneAccountSchema,
])

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.string().min(1).optional(),
  color: AccountColorSchema.optional(),
  icon: AccountIconSchema.optional(),
  isDefault: z.boolean().optional(),
  cardLabel: AccountCardLabelSchema.nullable().optional(),
})

export const AddPocketSchema = CreatePocketInputSchema

export const AccountUsageItemSchema = z.object({
  accountId: z.uuid(),
  count: z.number().int().nonnegative(),
})

export const AccountUsageResponseSchema = z.array(AccountUsageItemSchema)

export const AccountSeriesPointSchema = z.object({
  date: z.string(),
  balance: z.number(),
})

export const AccountSeriesItemSchema = z.object({
  accountId: z.uuid(),
  currency: z.string(),
  points: z.array(AccountSeriesPointSchema),
})

export const WalletSeriesItemSchema = z.object({
  walletId: z.uuid(),
  currency: z.string(),
  points: z.array(AccountSeriesPointSchema),
})

export const AccountSeriesResponseSchema = z.object({
  accounts: z.array(AccountSeriesItemSchema),
  wallets: z.array(WalletSeriesItemSchema),
})

export const AccountSeriesQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
})

export type Account = z.infer<typeof AccountSchema>
export type WalletPocket = z.infer<typeof WalletPocketSchema>
export type Wallet = z.infer<typeof WalletSchema>
export type AccountListItem = z.infer<typeof AccountListItemSchema>
export type AccountsResponse = z.infer<typeof AccountsResponseSchema>
export type AccountUsageItem = z.infer<typeof AccountUsageItemSchema>
export type AccountSeriesItem = z.infer<typeof AccountSeriesItemSchema>
export type WalletSeriesItem = z.infer<typeof WalletSeriesItemSchema>
export type AccountSeriesResponse = z.infer<typeof AccountSeriesResponseSchema>
