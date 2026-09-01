import { and, count, eq, inArray } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import { accounts, transactions, wallets } from "@workspace/db"
import type { Wallet } from "@workspace/api-contract"
import { db } from "@/db"
import { listAccountsFlat } from "@/modules/accounts/service"

export interface CreateWalletInput {
  organizationId: string
  userId: string
  name: string
  color?: string
  icon?: string
  pockets: Array<{ currency: string; balance: number }>
}

export async function createWallet(input: CreateWalletInput): Promise<Wallet> {
  const seen = new Set<string>()
  for (const p of input.pockets) {
    if (seen.has(p.currency)) {
      throw new HTTPException(400, {
        message: `Duplicate currency in pockets: ${p.currency}`,
      })
    }
    seen.add(p.currency)
  }

  const walletId = await db.transaction(async (tx) => {
    const [walletRow] = await tx
      .insert(wallets)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        color: input.color ?? null,
        icon: input.icon ?? null,
      })
      .returning({ id: wallets.id })

    if (input.pockets.length > 0) {
      await tx.insert(accounts).values(
        input.pockets.map((p) => ({
          organizationId: input.organizationId,
          walletId: walletRow.id,
          name: input.name,
          type: "wallet",
          currency: p.currency,
          initialBalance: p.balance,
        }))
      )
    }
    return walletRow.id
  })

  return loadWallet(walletId, input.organizationId, input.userId)
}

export interface UpdateWalletInput {
  id: string
  organizationId: string
  userId: string
  name?: string
  color?: string
  icon?: string
}

export async function updateWallet(input: UpdateWalletInput): Promise<Wallet> {
  const [existing] = await db
    .select()
    .from(wallets)
    .where(
      and(
        eq(wallets.id, input.id),
        eq(wallets.organizationId, input.organizationId)
      )
    )
    .limit(1)
  if (!existing) throw new HTTPException(404, { message: "Wallet not found" })

  await db
    .update(wallets)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, input.id))

  return loadWallet(input.id, input.organizationId, input.userId)
}

export async function deleteWallet(
  id: string,
  organizationId: string
): Promise<void> {
  // One transaction so a pocket transaction inserted between the count and the
  // delete can't slip past the guard and then be destroyed by the cascade.
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(wallets)
      .where(
        and(eq(wallets.id, id), eq(wallets.organizationId, organizationId))
      )
      .limit(1)
    if (!existing) throw new HTTPException(404, { message: "Wallet not found" })

    const pocketIds = (
      await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.walletId, id))
    ).map((r) => r.id)

    if (pocketIds.length > 0) {
      const [{ value: txCount }] = await tx
        .select({ value: count() })
        .from(transactions)
        .where(inArray(transactions.accountId, pocketIds))
      if (txCount > 0) {
        throw new HTTPException(409, {
          message: `Wallet has ${txCount} transaction${txCount !== 1 ? "s" : ""} and cannot be deleted`,
        })
      }
    }

    await tx.delete(wallets).where(eq(wallets.id, id))
  })
}

export interface AddPocketInput {
  walletId: string
  organizationId: string
  userId: string
  currency: string
  balance: number
}

export async function addPocket(input: AddPocketInput): Promise<Wallet> {
  const [walletRow] = await db
    .select()
    .from(wallets)
    .where(
      and(
        eq(wallets.id, input.walletId),
        eq(wallets.organizationId, input.organizationId)
      )
    )
    .limit(1)
  if (!walletRow) throw new HTTPException(404, { message: "Wallet not found" })

  const [existingPocket] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.walletId, input.walletId),
        eq(accounts.currency, input.currency)
      )
    )
    .limit(1)
  if (existingPocket) {
    throw new HTTPException(409, {
      message: `Wallet already has a ${input.currency} pocket`,
    })
  }

  await db.insert(accounts).values({
    organizationId: input.organizationId,
    walletId: input.walletId,
    name: walletRow.name,
    type: "wallet",
    currency: input.currency,
    initialBalance: input.balance,
  })

  return loadWallet(input.walletId, input.organizationId, input.userId)
}

export async function deletePocket(
  walletId: string,
  currency: string,
  organizationId: string,
  userId: string
): Promise<Wallet> {
  // One transaction so a transaction inserted against the pocket between the
  // count and the delete can't slip past the guard.
  await db.transaction(async (tx) => {
    const [walletRow] = await tx
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.id, walletId),
          eq(wallets.organizationId, organizationId)
        )
      )
      .limit(1)
    if (!walletRow) {
      throw new HTTPException(404, { message: "Wallet not found" })
    }

    const [pocket] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(eq(accounts.walletId, walletId), eq(accounts.currency, currency))
      )
      .limit(1)
    if (!pocket) throw new HTTPException(404, { message: "Pocket not found" })

    const [{ value: txCount }] = await tx
      .select({ value: count() })
      .from(transactions)
      .where(eq(transactions.accountId, pocket.id))
    if (txCount > 0) {
      throw new HTTPException(409, {
        message: `Pocket has ${txCount} transaction${txCount !== 1 ? "s" : ""} and cannot be deleted`,
      })
    }

    await tx.delete(accounts).where(eq(accounts.id, pocket.id))
  })
  return loadWallet(walletId, organizationId, userId)
}

export async function loadWallet(
  walletId: string,
  organizationId: string,
  userId: string
): Promise<Wallet> {
  const [walletRow] = await db
    .select()
    .from(wallets)
    .where(
      and(eq(wallets.id, walletId), eq(wallets.organizationId, organizationId))
    )
    .limit(1)
  if (!walletRow) throw new HTTPException(404, { message: "Wallet not found" })

  // Reuse listAccountsFlat so pocket balances include transaction sums + FX.
  const allAccounts = await listAccountsFlat(organizationId, userId)
  const pocketAccounts = allAccounts.filter((a) => a.walletId === walletId)

  const pockets = pocketAccounts.map((a) => ({
    accountId: a.id,
    currency: a.currency,
    balance: a.balance,
    homeBalance: a.homeBalance,
  }))

  return {
    id: walletRow.id,
    type: "wallet",
    name: walletRow.name,
    color: walletRow.color ?? null,
    icon: walletRow.icon ?? null,
    totalHomeBalance: pockets.reduce((sum, p) => sum + p.homeBalance, 0),
    pockets,
  }
}

// Whether `id` is a wallet in this org, used to route PATCH/DELETE /accounts/:id
// to the wallet or the leaf-account handler.
export async function walletExists(
  id: string,
  organizationId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.id, id), eq(wallets.organizationId, organizationId)))
    .limit(1)
  return !!row
}
