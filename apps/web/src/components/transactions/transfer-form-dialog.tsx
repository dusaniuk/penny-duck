import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
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

type AccountData = Account
type TransactionData = Transaction

interface TransferFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: TransactionData | null
  pairedAccountId?: string | null
  accounts: Array<AccountData>
  exchangeRates?: Record<string, Record<string, number>>
  onSubmit: (data: {
    fromAccountId: string
    toAccountId: string
    amount: number
    date: string
    note?: string
    originalAmount?: number
    originalCurrency?: string
    exchangeRate?: number
  }) => Promise<void>
  onDelete?: () => void
}

export function TransferFormDialog({
  open,
  onOpenChange,
  transaction,
  pairedAccountId,
  accounts,
  exchangeRates,
  onSubmit,
  onDelete,
}: TransferFormDialogProps) {
  const isEdit = !!transaction

  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const [showExchangeRate, setShowExchangeRate] = useState(false)
  const [exchangeRate, setExchangeRate] = useState("")
  const [receiveAmount, setReceiveAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const currenciesDiffer =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency
  const forceExchangeRate = !!currenciesDiffer

  useEffect(() => {
    if (forceExchangeRate) {
      setShowExchangeRate(true)
    }
  }, [forceExchangeRate])

  useEffect(() => {
    if (forceExchangeRate && exchangeRates && !isEdit) {
      const fromCurrency = fromAccount.currency
      const toCurrency = toAccount.currency
      const rate = (
        exchangeRates as Record<string, Record<string, number> | undefined>
      )[fromCurrency]?.[toCurrency]
      if (rate !== undefined) {
        setExchangeRate(rate.toFixed(6))
      }
    }
  }, [forceExchangeRate, fromAccount, toAccount, exchangeRates, isEdit])

  useEffect(() => {
    if (amount && exchangeRate) {
      const calc = parseFloat(amount) * parseFloat(exchangeRate)
      if (!isNaN(calc)) {
        setReceiveAmount(calc.toFixed(2))
      }
    }
  }, [amount, exchangeRate])

  useEffect(() => {
    if (open) {
      setFromAccountId(transaction?.accountId ?? "")
      setToAccountId(pairedAccountId ?? "")
      setAmount(transaction ? transaction.amount.toString() : "")
      setDate(
        transaction?.date
          ? new Date(transaction.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      )
      setNote(transaction?.note ?? "")
      setShowExchangeRate(transaction?.exchangeRate != null)
      setExchangeRate(transaction?.exchangeRate?.toString() ?? "")
      setReceiveAmount(transaction?.originalAmount?.toString() ?? "")
      setError(null)
    }
  }, [open, transaction])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onSubmit({
        fromAccountId,
        toAccountId,
        amount: parseFloat(amount),
        date: new Date(date).toISOString(),
        ...(note ? { note } : {}),
        ...(showExchangeRate && exchangeRate && receiveAmount
          ? {
              exchangeRate: parseFloat(exchangeRate),
              originalAmount: parseFloat(receiveAmount),
              originalCurrency: toAccount?.currency ?? "",
            }
          : {}),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const toAccountOptions = accounts.filter((a) => a.id !== fromAccountId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Transfer" : "New Transfer"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>Amount</FieldLabel>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </Field>

            <div className="flex items-end gap-2">
              <Field className="flex-1">
                <FieldLabel>From</FieldLabel>
                <Select
                  value={fromAccountId}
                  onValueChange={setFromAccountId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Source account" />
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
              <span className="pb-2.5 text-muted-foreground">→</span>
              <Field className="flex-1">
                <FieldLabel>To</FieldLabel>
                <Select
                  value={toAccountId}
                  onValueChange={setToAccountId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {toAccountOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.balance.toFixed(2)} {a.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel>Date</FieldLabel>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel>Note</FieldLabel>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                maxLength={500}
              />
            </Field>

            {!showExchangeRate && !forceExchangeRate && (
              <div className="border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowExchangeRate(true)}
                  className="text-xs text-primary hover:underline"
                >
                  + Exchange rate
                </button>
              </div>
            )}

            {showExchangeRate && (
              <div className="rounded-md border border-blue-400/30 bg-blue-400/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-400">
                    Exchange rate
                    {forceExchangeRate && (
                      <span className="ml-1 text-muted-foreground">
                        (required — different currencies)
                      </span>
                    )}
                  </span>
                  {!forceExchangeRate && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowExchangeRate(false)
                        setExchangeRate("")
                        setReceiveAmount("")
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field>
                    <FieldLabel>Rate</FieldLabel>
                    <Input
                      type="number"
                      step="0.000001"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      placeholder="41.52"
                      required={showExchangeRate}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Receive amount</FieldLabel>
                    <Input
                      type="number"
                      step="0.01"
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(e.target.value)}
                      placeholder="4152.00"
                      required={showExchangeRate}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Currency</FieldLabel>
                    <Input
                      value={toAccount?.currency ?? ""}
                      disabled={forceExchangeRate}
                      readOnly
                      placeholder="UAH"
                    />
                  </Field>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <div>
                {isEdit && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={onDelete}
                    disabled={loading}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading
                    ? "Saving…"
                    : isEdit
                      ? "Save Changes"
                      : "Create"}
                </Button>
              </div>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
