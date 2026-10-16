import { useMemo, useState } from "react"
import { IconChevronDown } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { Account, Wallet } from "@workspace/api-contract"
import type { AccountData } from "@/components/accounts/account-card"
import { AccountCard } from "@/components/accounts/account-card"

type StandaloneType = "bank" | "brokerage" | "loan"

type GroupKey = "wallet" | StandaloneType

const GROUP_ORDER: Array<GroupKey> = ["wallet", "bank", "brokerage", "loan"]

const GROUP_LABEL: Record<GroupKey, string> = {
  wallet: "Wallet",
  bank: "Bank",
  brokerage: "Brokerage",
  loan: "Liabilities",
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

// Synthesize an AccountData entry from a Wallet so the AccountCard can render
// it. The card branches on `pockets` to render the multi-currency balance.
function walletToAccountData(w: Wallet, homeCurrency: string): AccountData {
  return {
    id: w.id,
    name: w.name,
    type: "wallet",
    currency: homeCurrency,
    color: w.color,
    icon: w.icon,
    balance: w.totalHomeBalance,
    homeBalance: w.totalHomeBalance,
    isDefault: false,
    cardLabel: null,
    walletId: null,
    archivedAt: w.archivedAt,
    pockets: w.pockets,
  }
}

type Props = {
  accounts: Array<Account>
  wallets: Array<Wallet>
  archivedAccounts: Array<Account>
  archivedWallets: Array<Wallet>
  homeCurrency: string
  seriesByAccount: Map<string, Array<number>>
  onEdit: (a: AccountData) => void
  onSetDefault: (a: AccountData) => void
  onEditWallet: (w: Wallet) => void
  onUnarchive: (a: AccountData) => void
}

export function AccountsGroups({
  accounts,
  wallets,
  archivedAccounts,
  archivedWallets,
  homeCurrency,
  seriesByAccount,
  onEdit,
  onSetDefault,
  onEditWallet,
  onUnarchive,
}: Props) {
  const [showArchived, setShowArchived] = useState(false)
  const archivedEntries = useMemo<Array<AccountData>>(
    () => [
      ...archivedWallets.map((w) => walletToAccountData(w, homeCurrency)),
      ...archivedAccounts,
    ],
    [archivedWallets, archivedAccounts, homeCurrency]
  )
  const walletEntries = useMemo(
    () => wallets.map((w) => walletToAccountData(w, homeCurrency)),
    [wallets, homeCurrency]
  )
  const walletsById = useMemo(
    () => new Map(wallets.map((w) => [w.id, w])),
    [wallets]
  )

  type Group = {
    key: GroupKey
    label: string
    items: Array<AccountData>
    subtotal: number
    isApprox: boolean
  }

  const groups = useMemo<Array<Group>>(() => {
    return GROUP_ORDER.flatMap<Group>((key) => {
      if (key === "wallet") {
        if (walletEntries.length === 0) return []
        const subtotal = walletEntries.reduce(
          (sum, a) => sum + a.homeBalance,
          0
        )
        const isApprox = wallets.some((w) =>
          w.pockets.some((p) => p.currency !== homeCurrency)
        )
        return [
          {
            key,
            label: GROUP_LABEL[key],
            items: walletEntries,
            subtotal,
            isApprox,
          },
        ]
      }
      const items = accounts
        .filter((a) => a.type === key)
        .sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
          return b.balance - a.balance
        })
      if (items.length === 0) return []
      const subtotal =
        key === "loan"
          ? items.reduce((sum, a) => sum + Math.abs(a.homeBalance), 0)
          : items.reduce((sum, a) => sum + a.homeBalance, 0)
      const isApprox = items.some((a) => a.currency !== homeCurrency)
      return [
        {
          key,
          label: GROUP_LABEL[key],
          items: items as Array<AccountData>,
          subtotal,
          isApprox,
        },
      ]
    })
  }, [accounts, walletEntries, wallets, homeCurrency])

  function handleCardEdit(a: AccountData) {
    if (a.pockets) {
      const wallet = walletsById.get(a.id)
      if (wallet) onEditWallet(wallet)
      return
    }
    onEdit(a)
  }

  return (
    <section className="space-y-8">
      {groups.map((g) => (
        <div key={g.key} className="space-y-3.5">
          <header className="flex items-baseline justify-between gap-2 px-1">
            <div className="flex items-baseline gap-2.5">
              <h2 className="font-heading text-[15px] font-semibold">
                {g.label}
              </h2>
              <span className="font-mono text-[11px] text-muted-foreground">
                {g.items.length}{" "}
                {g.key === "wallet"
                  ? g.items.length === 1
                    ? "wallet"
                    : "wallets"
                  : g.key === "loan"
                    ? g.items.length === 1
                      ? "loan"
                      : "loans"
                    : g.items.length === 1
                      ? "account"
                      : "accounts"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 tabular-nums">
              {g.isApprox && (
                <span className="text-[11px] text-muted-foreground/70">≈</span>
              )}
              <span className="font-heading text-lg font-semibold">
                {formatInt(g.subtotal)}
              </span>
              {homeCurrency && (
                <span className="text-[11px] text-muted-foreground">
                  {homeCurrency}
                </span>
              )}
            </div>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.items.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                series={seriesByAccount.get(a.id)}
                onEdit={handleCardEdit}
                onSetDefault={onSetDefault}
              />
            ))}
          </div>
        </div>
      ))}

      {archivedEntries.length > 0 && (
        <div className="space-y-3.5">
          <header className="flex items-baseline justify-between gap-2 px-1">
            <div className="flex items-baseline gap-2.5">
              <h2 className="font-heading text-[15px] font-semibold text-muted-foreground">
                Archived
              </h2>
              <span className="font-mono text-[11px] text-muted-foreground">
                {archivedEntries.length}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded={showArchived}
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Hide" : "Show"}
              <IconChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  showArchived && "rotate-180"
                )}
              />
            </Button>
          </header>
          {showArchived && (
            <div className="grid gap-3 sm:grid-cols-2">
              {archivedEntries.map((a) => (
                <AccountCard
                  key={a.id}
                  account={a}
                  series={undefined}
                  onEdit={handleCardEdit}
                  onSetDefault={onSetDefault}
                  onUnarchive={onUnarchive}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
