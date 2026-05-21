import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useQuery } from "@tanstack/react-query"
import type { Account } from "@workspace/api-contract"
import { api } from "@/lib/api"
import { PortfolioSummary } from "@/components/investments/portfolio-summary"
import { PositionsTable } from "@/components/investments/positions-table"
import { TradeFormDialog } from "@/components/investments/trade-form-dialog"
import { useTradeCreate } from "@/components/investments/use-trade-create"
import { IbkrImportDialog } from "@/components/investments/import/ibkr-import-dialog"

export const Route = createFileRoute("/_app/investments/")({
  component: InvestmentsIndexPage,
})

function InvestmentsIndexPage() {
  const [tradeOpen, setTradeOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const navigate = useNavigate()

  const { data: positionsData, isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const res = await api.positions.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const positions = positionsData?.positions ?? []
  const pricesStale = positionsData?.pricesStale ?? false

  const { data: summaryData } = useQuery({
    queryKey: ["investments-summary"],
    queryFn: async () => {
      const res = await api.investments.summary.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const { data: meData } = useQuery({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await api.users.me.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const homeCurrency = meData?.homeCurrency ?? "UAH"

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.accounts.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const brokerages: Array<Account> = (accountsData ?? []).filter(
    (a) => a.type === "brokerage"
  )

  // Imports bump initial_balance by the deposit total without dedup, so a
  // re-import would double-count. Only allow imports into brokerage accounts
  // that don't already have trades (i.e., fresh accounts).
  const { data: tradesData } = useQuery({
    queryKey: ["trades", "all"],
    queryFn: async () => {
      const res = await api.trades.$get({ query: {} })
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const accountIdsWithTrades = new Set(
    (tradesData ?? []).map((t) => t.accountId)
  )
  const importableAccounts = brokerages.filter(
    (a) => !accountIdsWithTrades.has(a.id)
  )

  const createMutation = useTradeCreate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Investments</h1>
        <div className="flex gap-2">
          {importableAccounts.length > 0 && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import from IBKR
            </Button>
          )}
          <Button
            onClick={() => setTradeOpen(true)}
            disabled={brokerages.length === 0}
          >
            Add trade
          </Button>
        </div>
      </div>

      {pricesStale && (
        <div className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          Prices could not be refreshed; showing last known values.
        </div>
      )}

      {summaryData && (
        <PortfolioSummary summary={summaryData} homeCurrency={homeCurrency} />
      )}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      ) : (
        <PositionsTable
          positions={positions}
          onRowClick={(p) =>
            navigate({
              to: "/investments/$accountId/$symbol",
              params: { accountId: p.accountId, symbol: p.symbol },
            })
          }
        />
      )}

      <TradeFormDialog
        open={tradeOpen}
        onOpenChange={setTradeOpen}
        accounts={brokerages}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data)
        }}
      />
      <IbkrImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        accounts={importableAccounts}
      />
    </div>
  )
}
