import { useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { Account, Member, Transaction } from "@workspace/api-contract"

interface ReimbursementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
  accounts: Array<Account>
  members: Array<Member>
  currentUserId: string
  exchangeRates?: Record<string, Record<string, number>>
  onSubmit: (data: {
    transactionId: string
    accountId: string
    amount: number
    date: string
    exchangeRate?: number
    madeById?: string
  }) => Promise<void>
}

export function ReimbursementDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  members,
  currentUserId,
  exchangeRates,
  onSubmit,
}: ReimbursementDialogProps) {
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [exchangeRate, setExchangeRate] = useState("")
  const [date, setDate] = useState("")
  const [madeById, setMadeById] = useState("")
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
      setMadeById(currentUserId)
      setError(null)
    }
  }, [open, currentUserId])

  useEffect(() => {
    if (isCrossCurrency && exchangeRates) {
      const fromCurrency = expenseAccount.currency
      const toCurrency = selectedAccount.currency
      const rate = (
        exchangeRates as Record<string, Record<string, number> | undefined>
      )[fromCurrency]?.[toCurrency]
      if (rate !== undefined) {
        setExchangeRate(rate.toFixed(6))
      }
    }
  }, [isCrossCurrency, expenseAccount, selectedAccount, exchangeRates])

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
        ...(members.length > 1 ? { madeById } : {}),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Add reimbursement</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {transaction.note ?? "Transaction"} &middot; -
            {transaction.amount.toFixed(2)} {expenseAccount?.currency} remaining
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>Account</FieldLabel>
              <Select value={accountId} onValueChange={setAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.id !== transaction.accountId)
                    .map((a) => (
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

            {members.length > 1 && (
              <Field>
                <FieldLabel>Made by</FieldLabel>
                <Select value={madeById} onValueChange={setMadeById} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                          {m.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

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
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
