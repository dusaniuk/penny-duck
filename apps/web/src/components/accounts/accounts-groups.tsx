import { useMemo } from "react"
import type { Account } from "@workspace/api-contract"
import type { AccountData } from "@/components/accounts/account-card"
import { AccountCard } from "@/components/accounts/account-card"

type AccountType = "bank" | "brokerage" | "cash"

const TYPE_ORDER: Array<AccountType> = ["bank", "brokerage", "cash"]

const TYPE_LABEL: Record<AccountType, string> = {
  bank: "Bank",
  brokerage: "Brokerage",
  cash: "Cash",
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

type Props = {
  accounts: Array<Account>
  homeCurrency: string
  seriesByAccount: Map<string, Array<number>>
  onEdit: (a: AccountData) => void
  onSetDefault: (a: AccountData) => void
}

export function AccountsGroups({
  accounts,
  homeCurrency,
  seriesByAccount,
  onEdit,
  onSetDefault,
}: Props) {
  const groups = useMemo(() => {
    return TYPE_ORDER.flatMap((type) => {
      const items = accounts
        .filter((a) => a.type === type)
        .sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
          return b.balance - a.balance
        })
      if (items.length === 0) return []
      const subtotal = items.reduce((sum, a) => sum + a.homeBalance, 0)
      const isApprox = items.some((a) => a.currency !== homeCurrency)
      return [
        {
          type,
          label: TYPE_LABEL[type],
          items,
          subtotal,
          isApprox,
        },
      ]
    })
  }, [accounts, homeCurrency])

  return (
    <section className="space-y-8">
      {groups.map((g) => (
        <div key={g.type} className="space-y-3.5">
          <header className="flex items-baseline justify-between gap-2 px-1">
            <div className="flex items-baseline gap-2.5">
              <h2 className="font-heading text-[15px] font-semibold">
                {g.label}
              </h2>
              <span className="font-mono text-[11px] text-muted-foreground">
                {g.items.length} {g.items.length === 1 ? "account" : "accounts"}
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
                onEdit={onEdit}
                onSetDefault={onSetDefault}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
