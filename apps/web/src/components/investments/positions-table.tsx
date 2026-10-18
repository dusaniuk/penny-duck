import { useState } from "react"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import type { Position } from "@workspace/api-contract"
import { formatSigned, toTypographicMinus } from "@/lib/money"

function fmt(n: number, currency: string, signed = false) {
  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(n)
  return signed ? toTypographicMinus(formatted) : formatted
}

interface PositionsTableProps {
  positions: Array<Position>
  onRowClick?: (p: Position) => void
}

export function PositionsTable({ positions, onRowClick }: PositionsTableProps) {
  const [showClosed, setShowClosed] = useState(false)
  const visible = positions.filter((p) => showClosed || p.quantity > 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <Switch
          id="show-closed"
          checked={showClosed}
          onCheckedChange={setShowClosed}
        />
        <Label htmlFor="show-closed" className="text-sm">
          Show closed positions
        </Label>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg cost</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Unrealized</TableHead>
              <TableHead className="text-right">Realized</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  No positions yet. Add a trade to get started.
                </TableCell>
              </TableRow>
            )}
            {visible.map((p) => (
              <TableRow
                key={`${p.accountId}:${p.symbol}`}
                className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={onRowClick ? () => onRowClick(p) : undefined}
              >
                <TableCell className="font-medium">{p.symbol}</TableCell>
                <TableCell className="max-w-50 truncate">{p.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.quantity.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(p.averageCost, p.currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(p.currentPrice, p.currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(p.currentValue, p.currency)}
                </TableCell>
                <TableCell
                  className={
                    "text-right tabular-nums " +
                    (p.unrealizedGain >= 0
                      ? "text-emerald-600"
                      : "text-rose-600")
                  }
                >
                  {fmt(p.unrealizedGain, p.currency, true)} (
                  {formatSigned(p.unrealizedGainPct)}%)
                </TableCell>
                <TableCell
                  className={
                    "text-right tabular-nums " +
                    (p.realizedGain >= 0 ? "text-emerald-600" : "text-rose-600")
                  }
                >
                  {fmt(p.realizedGain, p.currency, true)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
