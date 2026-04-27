import { createFileRoute, useParams } from "@tanstack/react-router"
import { tsr } from "@/lib/api"

export const Route = createFileRoute("/_app/investments/$accountId_/$symbol")({
  staticData: { breadcrumb: "Position" },
  component: PositionPage,
})

function PositionPage() {
  const { accountId, symbol } = useParams({
    from: "/_app/investments/$accountId_/$symbol",
  })

  const { data: positionData } = tsr.investments.getPositionBySymbol.useQuery({
    queryKey: ["positions", accountId, symbol],
    queryData: { params: { accountId, symbol } },
  })
  const position = positionData?.status === 200 ? positionData.body : undefined

  const { data: tradesData } = tsr.investments.listTrades.useQuery({
    queryKey: ["trades", accountId, symbol],
    queryData: { query: { accountId, symbol } },
    enabled: !!position,
  })
  const trades = tradesData?.body ?? []

  if (!position) return <div>Loading…</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          {position.symbol} — {position.name}
        </h1>
        <p className="text-muted-foreground">
          {position.quantity} @ {position.averageCost.toFixed(2)}{" "}
          {position.currency} · Current {position.currentPrice.toFixed(2)}
        </p>
        <p>
          Unrealized{" "}
          <span
            className={
              position.unrealizedGain >= 0
                ? "text-emerald-600"
                : "text-rose-600"
            }
          >
            {position.unrealizedGain.toFixed(2)} (
            {position.unrealizedGainPct.toFixed(2)}%)
          </span>
        </p>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">Fees</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="p-2">{t.date.slice(0, 10)}</td>
                <td className="p-2 capitalize">{t.type}</td>
                <td className="p-2 text-right">{t.quantity ?? "—"}</td>
                <td className="p-2 text-right">{t.price ?? "—"}</td>
                <td className="p-2 text-right">{t.amount}</td>
                <td className="p-2 text-right">{t.fees}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
