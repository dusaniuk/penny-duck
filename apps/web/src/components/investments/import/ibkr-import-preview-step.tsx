import { useMemo } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import type { ImportTradesResponse } from "@workspace/api-contract"

interface Props {
  result: ImportTradesResponse
  onConfirm: () => void
  onBack: () => void
  submitting: boolean
  error: string | null
}

interface SymbolGroup {
  symbol: string
  trades: number
  dividends: number
  grossDividend: number
  skipped: number
  errors: number
}

export function IbkrImportPreviewStep({
  result,
  onConfirm,
  onBack,
  submitting,
  error,
}: Props) {
  const groups = useMemo<Array<SymbolGroup>>(() => {
    const bySymbol = new Map<string, SymbolGroup>()
    for (const row of result.rows) {
      const g = bySymbol.get(row.symbol) ?? {
        symbol: row.symbol,
        trades: 0,
        dividends: 0,
        grossDividend: 0,
        skipped: 0,
        errors: 0,
      }
      if (row.status === "error") g.errors++
      else if (row.status === "duplicate") g.skipped++
      else if (row.kind === "dividend") {
        g.dividends++
        g.grossDividend += row.amount
      } else {
        g.trades++
      }
      bySymbol.set(row.symbol, g)
    }
    return Array.from(bySymbol.values()).sort((a, b) =>
      a.symbol.localeCompare(b.symbol)
    )
  }, [result.rows])

  const canCommit =
    result.summary.rowErrors === 0 &&
    result.summary.tradesToCreate +
      result.summary.dividendsToCreate +
      result.summary.depositsFound >
      0

  return (
    <div className="space-y-4">
      <SummaryCard summary={result.summary} />
      {result.summary.rowErrors > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
          {result.summary.rowErrors} row(s) have errors. Fix the CSV and
          re-upload.
        </div>
      )}
      {result.summary.depositsTotalAmount !== 0 && (
        <div className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          {result.summary.depositsTotalAmount > 0 ? "+" : ""}
          {result.summary.depositsTotalAmount.toFixed(2)} from{" "}
          {result.summary.depositsFound} deposit/withdrawal row(s) will be added
          to this account&apos;s starting balance.
        </div>
      )}
      {result.parseErrors.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
          <p className="font-medium">
            {result.parseErrors.length} parse error(s) — these rows were
            skipped:
          </p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {result.parseErrors.slice(0, 20).map((e) => (
              <li key={`${e.line}-${e.reason}`}>
                Line {e.line}: {e.reason}
              </li>
            ))}
            {result.parseErrors.length > 20 && (
              <li className="italic">
                …and {result.parseErrors.length - 20} more
              </li>
            )}
          </ul>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead className="text-right">Trades</TableHead>
            <TableHead className="text-right">Dividends</TableHead>
            <TableHead className="text-right">Gross div</TableHead>
            <TableHead className="text-right">Skipped</TableHead>
            <TableHead className="text-right">Errors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={g.symbol}>
              <TableCell className="font-mono">{g.symbol}</TableCell>
              <TableCell className="text-right">{g.trades}</TableCell>
              <TableCell className="text-right">{g.dividends}</TableCell>
              <TableCell className="text-right">
                {g.grossDividend.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">{g.skipped}</TableCell>
              <TableCell className="text-right">{g.errors}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={!canCommit || submitting}
        >
          {submitting
            ? "Importing…"
            : `Import ${result.summary.tradesToCreate} trades, ${result.summary.dividendsToCreate} dividends${
                result.summary.depositsTotalAmount !== 0
                  ? ` (+${result.summary.depositsTotalAmount.toFixed(2)} starting balance)`
                  : ""
              }`}
        </Button>
      </div>
    </div>
  )
}

function SummaryCard({
  summary,
}: {
  summary: ImportTradesResponse["summary"]
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm md:grid-cols-4">
      <Stat label="Trades found" value={summary.tradesFound} />
      <Stat label="New trades" value={summary.tradesToCreate} />
      <Stat label="Duplicate trades" value={summary.tradesSkippedAsDuplicate} />
      <Stat label="Dividends found" value={summary.dividendsFound} />
      <Stat label="New dividends" value={summary.dividendsToCreate} />
      <Stat
        label="Duplicate dividends"
        value={summary.dividendsSkippedAsDuplicate}
      />
      <Stat label="Deposits found" value={summary.depositsFound} />
      <Stat
        label="Deposits total"
        value={summary.depositsTotalAmount.toFixed(2)}
      />
      <Stat label="Row errors" value={summary.rowErrors} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
