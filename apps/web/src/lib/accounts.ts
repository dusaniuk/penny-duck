import type { Account, AccountsResponse, Wallet } from "@workspace/api-contract"

// GET /accounts returns a flat list of leaf accounts and wallets. A wallet
// carries its pockets; a leaf does not — so `"pockets" in item` discriminates.
export function isWallet(item: Account | Wallet): item is Wallet {
  return "pockets" in item
}

export function isArchived(item: Account | Wallet): boolean {
  return item.archivedAt != null
}

// Archived accounts stay in the /accounts response so historical transactions
// can still resolve their account. Every helper below hides them unless asked
// to include them, so pickers, totals and the accounts grid never see them by
// accident — only lookups that render history opt in.
export type ListOptions = { includeArchived?: boolean }

function visible<T extends Account | Wallet>(
  items: Array<T>,
  options: ListOptions | undefined
): Array<T> {
  return options?.includeArchived ? items : items.filter((i) => !isArchived(i))
}

export function walletsOf(
  data: AccountsResponse | undefined,
  options?: ListOptions
): Array<Wallet> {
  return visible((data ?? []).filter(isWallet), options)
}

export function leafAccountsOf(
  data: AccountsResponse | undefined,
  options?: ListOptions
): Array<Account> {
  return visible(
    (data ?? []).filter((item): item is Account => !isWallet(item)),
    options
  )
}

// Synthesize an Account row per wallet pocket. Pockets are real account rows on
// the backend but are folded into their wallet in the /accounts list — the
// accounts page renders them inside the wallet card. Anywhere that needs to
// pick a pocket as a transaction source/destination (transaction form, transfer
// dialogs) gets the synthesized list from here.
export function walletPocketsAsAccounts(
  wallets: Array<Wallet>
): Array<Account> {
  return wallets.flatMap((w) =>
    w.pockets.map((p) => ({
      id: p.accountId,
      name: w.name,
      type: "wallet",
      currency: p.currency,
      color: w.color,
      icon: w.icon,
      balance: p.balance,
      homeBalance: p.homeBalance,
      isDefault: false,
      walletId: w.id,
      cardLabel: null,
      archivedAt: w.archivedAt,
    }))
  )
}

// Leaf accounts plus pocket accounts. Use this whenever a transaction form needs
// to look up an account by id regardless of whether it lives inside a wallet.
export function flattenAccounts(
  data: AccountsResponse | undefined,
  options?: ListOptions
): Array<Account> {
  return [
    ...leafAccountsOf(data, options),
    ...walletPocketsAsAccounts(walletsOf(data, options)),
  ]
}
