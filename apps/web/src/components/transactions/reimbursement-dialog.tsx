import { useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { Account, Transaction } from "@workspace/api-contract"

interface ReimbursementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
  accounts: Array<Account>
  onSubmit: (data: {
    transactionId: string
    accountId: string
    amount: number
    date: string
    exchangeRate?: number
  }) => Promise<void>
}

export function ReimbursementDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  onSubmit,
}: ReimbursementDialogProps) {
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [exchangeRate, setExchangeRate] = useState("")
  const [date, setDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expenseAccount = useMemo(
    () => accounts.find((a) => a.id === transaction?.accountId),
    [accounts, transaction?.accountId]
  )

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  )

  const isCrossCurrency =
    selectedAccount &&
    expenseAccount &&
    selectedAccount.currency !== expenseAccount.currency

  const [convertedAmount, setConvertedAmount] = useState("")

  function handleAmountChange(value: string) {
    setAmount(value)
    const amt = parseFloat(value)
    const rate = parseFloat(exchangeRate)
    if (!isNaN(amt) && !isNaN(rate) && rate > 0) {
      setConvertedAmount((amt / rate).toFixed(2))
    }
  }

  function handleExchangeRateChange(value: string) {
    setExchangeRate(value)
    const amt = parseFloat(amount)
    const rate = parseFloat(value)
    if (!isNaN(amt) && !isNaN(rate) && rate > 0) {
      setConvertedAmount((amt / rate).toFixed(2))
    }
  }

  function handleConvertedAmountChange(value: string) {
    setConvertedAmount(value)
    const amt = parseFloat(amount)
    const converted = parseFloat(value)
    if (!isNaN(amt) && !isNaN(converted) && converted > 0) {
      setExchangeRate((amt / converted).toFixed(6))
    }
  }

  useEffect(() => {
    if (open) {
      setAccountId("")
      setAmount("")
      setExchangeRate("")
      setConvertedAmount("")
      setDate(new Date().toISOString().split("T")[0])
      setError(null)
    }
  }, [open])

  if (!transaction) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onSubmit({
        transactionId: transaction!.id,
        accountId,
        amount: parseFloat(amount),
        date: new Date(date).toISOString(),
        ...(isCrossCurrency && exchangeRate
          ? { exchangeRate: 1 / parseFloat(exchangeRate) }
          : {}),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add reimbursement</DialogTitle>
          <DialogDescription>
            {transaction.note ?? "Transaction"} &middot; -
            {transaction.amount.toFixed(2)} {expenseAccount?.currency} remaining
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>Account</FieldLabel>
              <Select value={accountId} onValueChange={setAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — {a.balance.toFixed(2)} {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>
                Amount received
                {selectedAccount ? ` (${selectedAccount.currency})` : ""}
              </FieldLabel>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                required
              />
            </Field>

            {isCrossCurrency && (
              <div className="rounded-md border border-blue-400/30 bg-blue-400/5 p-3">
                <Field>
                  <FieldLabel>
                    Exchange rate (1 {expenseAccount.currency} ={" "}
                    {exchangeRate || "?"} {selectedAccount.currency})
                  </FieldLabel>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      value={exchangeRate}
                      onChange={(e) =>
                        handleExchangeRateChange(e.target.value)
                      }
                      placeholder="12.00"
                      required
                      className="flex-1"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      =
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={convertedAmount}
                      onChange={(e) =>
                        handleConvertedAmountChange(e.target.value)
                      }
                      placeholder="0.00"
                      className="flex-1"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {expenseAccount.currency}
                    </span>
                  </div>
                </Field>
              </div>
            )}

            <Field>
              <FieldLabel>Date</FieldLabel>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding…" : "Add"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
