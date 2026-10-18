import { SelectableSurface } from "@workspace/ui/components/selectable-surface"
import { cn } from "@workspace/ui/lib/utils"
import type { Account, AccountUsageItem, Wallet } from "@workspace/api-contract"
import { paletteColor } from "@/lib/palette"
import { formatBalance } from "@/lib/money"

type Chip =
  | { kind: "account"; account: Account }
  | { kind: "wallet"; wallet: Wallet; pockets: Array<Account> }

function buildChips(
  accounts: Array<Account>,
  wallets: Array<Wallet>
): Array<Chip> {
  const chips: Array<Chip> = []

  for (const wallet of wallets) {
    const pockets = accounts.filter((a) => a.walletId === wallet.id)
    if (pockets.length === 0) continue
    chips.push({ kind: "wallet", wallet, pockets })
  }

  for (const account of accounts) {
    if (account.walletId === null) {
      chips.push({ kind: "account", account })
    }
  }

  return chips
}

interface TransactionAccountChipsProps {
  accounts: Array<Account>
  wallets?: Array<Wallet>
  selectedId: string
  onSelect: (id: string) => void
  label?: string
  accountUsage?: ReadonlyArray<AccountUsageItem>
}

export function TransactionAccountChips({
  accounts,
  wallets = [],
  selectedId,
  onSelect,
  label = "From account",
  accountUsage = [],
}: TransactionAccountChipsProps) {
  const chips = buildChips(accounts, wallets)

  // Find the active wallet (if the selected account belongs to one)
  const selectedAccount = accounts.find((a) => a.id === selectedId)
  const activeWallet =
    selectedAccount?.walletId != null
      ? wallets.find((w) => w.id === selectedAccount.walletId)
      : null
  const activeWalletPockets =
    activeWallet != null
      ? accounts.filter((a) => a.walletId === activeWallet.id)
      : []

  function pickDefaultPocket(pockets: Array<Account>): string {
    if (pockets.length === 0) return ""
    const usageMap = new Map(accountUsage.map((u) => [u.accountId, u.count]))
    const best = [...pockets].sort((a, b) => {
      const ua = usageMap.get(a.id) ?? 0
      const ub = usageMap.get(b.id) ?? 0
      if (ua !== ub) return ub - ua
      return a.currency.localeCompare(b.currency)
    })
    return best[0].id
  }

  return (
    <div className="flex flex-col">
      <div className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-foreground/40 uppercase">
        {label}
      </div>
      <div className="-m-1 flex scrollbar-none gap-1.5 overflow-x-auto p-1 [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => {
          if (chip.kind === "account") {
            const active = chip.account.id === selectedId
            const color = paletteColor(chip.account.color, { l: 0.7, c: 0.16 })
            return (
              <SelectableSurface
                key={chip.account.id}
                aria-pressed={active}
                onClick={() => onSelect(chip.account.id)}
                className="flex max-w-42.5 min-w-35 shrink-0 items-center gap-2 px-2.75 py-2.25 text-left sm:min-w-37.5 sm:px-3 sm:py-2.5"
                style={active ? { borderColor: color } : undefined}
              >
                <AccountDot color={color} />
                <AccountText account={chip.account} />
              </SelectableSurface>
            )
          }

          const { wallet, pockets } = chip
          const isWalletActive = pockets.some((p) => p.id === selectedId)
          const walletColor = paletteColor(wallet.color, { l: 0.7, c: 0.16 })
          const currencyLabels = pockets
            .map((p) => p.currency)
            .sort()
            .join(" · ")
          return (
            <SelectableSurface
              key={wallet.id}
              aria-pressed={isWalletActive}
              onClick={() => {
                // If a pocket in this wallet is already selected, keep it.
                // Otherwise pick the default pocket.
                const alreadySelected = pockets.some((p) => p.id === selectedId)
                if (!alreadySelected) {
                  onSelect(pickDefaultPocket(pockets))
                }
              }}
              className="flex max-w-42.5 min-w-35 shrink-0 items-center gap-2 px-2.75 py-2.25 text-left sm:min-w-37.5 sm:px-3 sm:py-2.5"
              style={isWalletActive ? { borderColor: walletColor } : undefined}
            >
              <AccountDot color={walletColor} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-foreground">
                  {wallet.name}
                </div>
                <div className="truncate text-[11px] text-foreground/45 tabular-nums">
                  {currencyLabels}
                </div>
              </div>
            </SelectableSurface>
          )
        })}
      </div>

      {activeWallet && activeWalletPockets.length > 1 && (
        <div className="mt-2 flex gap-1.5 px-1">
          {[...activeWalletPockets]
            .sort((a, b) => a.currency.localeCompare(b.currency))
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                aria-pressed={p.id === selectedId}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] tabular-nums",
                  p.id === selectedId
                    ? "border-violet-500 bg-violet-500/10 text-violet-600"
                    : "border-foreground/10 text-foreground/60 hover:border-foreground/20"
                )}
              >
                {p.currency}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

interface TransactionAccountBlockProps {
  account: Account
  onClick?: () => void
}

export function TransactionAccountBlock({
  account,
  onClick,
}: TransactionAccountBlockProps) {
  return (
    <SelectableSurface
      onClick={onClick}
      className="flex w-full items-center gap-2 border-violet-500/40 px-2.75 py-2.25 text-left sm:px-3 sm:py-2.5 dark:border-violet-300/35"
    >
      <AccountDot color={paletteColor(account.color, { l: 0.7, c: 0.16 })} />
      <AccountText account={account} />
    </SelectableSurface>
  )
}

function AccountDot({ color }: { color: string }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  )
}

function AccountText({ account }: { account: Account }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-[12.5px] font-medium text-foreground">
        {account.name}
      </div>
      <div className="truncate text-[11px] text-foreground/45 tabular-nums">
        {formatBalance(account.balance)} {account.currency}
      </div>
    </div>
  )
}
