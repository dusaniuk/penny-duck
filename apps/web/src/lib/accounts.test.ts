import { describe, expect, it } from "vitest"
import {
  flattenAccounts,
  isArchived,
  leafAccountsOf,
  walletPocketsAsAccounts,
  walletsOf,
} from "./accounts"
import type { Account, Wallet } from "@workspace/api-contract"

function account(over: Partial<Account>): Account {
  return {
    id: crypto.randomUUID(),
    name: "Acc",
    type: "bank",
    currency: "UAH",
    color: null,
    icon: null,
    balance: 0,
    homeBalance: 0,
    isDefault: false,
    cardLabel: null,
    walletId: null,
    archivedAt: null,
    ...over,
  }
}

function wallet(over: Partial<Wallet>): Wallet {
  return {
    id: crypto.randomUUID(),
    type: "wallet",
    name: "Wallet",
    color: null,
    icon: null,
    totalHomeBalance: 0,
    pockets: [],
    archivedAt: null,
    ...over,
  }
}

const ARCHIVED = "2026-10-01T00:00:00.000Z"

describe("account list helpers — archived filtering", () => {
  const active = account({ name: "Active" })
  const archived = account({ name: "Old", archivedAt: ARCHIVED })
  const activeWallet = wallet({
    name: "Cash",
    pockets: [
      {
        accountId: crypto.randomUUID(),
        currency: "UAH",
        balance: 1,
        homeBalance: 1,
      },
    ],
  })
  const archivedWallet = wallet({
    name: "Old cash",
    archivedAt: ARCHIVED,
    pockets: [
      {
        accountId: crypto.randomUUID(),
        currency: "USD",
        balance: 2,
        homeBalance: 80,
      },
    ],
  })
  const data = [active, archived, activeWallet, archivedWallet]

  it("leafAccountsOf drops archived accounts by default", () => {
    expect(leafAccountsOf(data).map((a) => a.name)).toEqual(["Active"])
  })

  it("leafAccountsOf keeps archived accounts when asked", () => {
    expect(
      leafAccountsOf(data, { includeArchived: true }).map((a) => a.name)
    ).toEqual(["Active", "Old"])
  })

  it("walletsOf drops archived wallets by default", () => {
    expect(walletsOf(data).map((w) => w.name)).toEqual(["Cash"])
  })

  it("walletsOf keeps archived wallets when asked", () => {
    expect(
      walletsOf(data, { includeArchived: true }).map((w) => w.name)
    ).toEqual(["Cash", "Old cash"])
  })

  it("flattenAccounts drops archived leaves and archived wallets' pockets", () => {
    const ids = flattenAccounts(data).map((a) => a.id)
    expect(ids).toEqual([active.id, activeWallet.pockets[0].accountId])
  })

  it("flattenAccounts keeps everything when asked", () => {
    const ids = flattenAccounts(data, { includeArchived: true }).map(
      (a) => a.id
    )
    expect(ids).toEqual([
      active.id,
      archived.id,
      activeWallet.pockets[0].accountId,
      archivedWallet.pockets[0].accountId,
    ])
  })

  it("walletPocketsAsAccounts carries the wallet's archivedAt onto each pocket", () => {
    const pockets = walletPocketsAsAccounts([archivedWallet])
    expect(pockets[0].archivedAt).toBe(ARCHIVED)
  })

  it("isArchived is true only when archivedAt is set", () => {
    expect(isArchived(active)).toBe(false)
    expect(isArchived(archived)).toBe(true)
    expect(isArchived(archivedWallet)).toBe(true)
  })
})
