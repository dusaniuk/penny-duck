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
import type {
  AccountData,
  CategoryData,
  TransactionData,
} from "./transaction-types"

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: TransactionData | null
  defaultType?: "expense" | "income"
  accounts: Array<AccountData>
  categories: Array<CategoryData>
  onSubmit: (data: {
    accountId: string
    type: string
    amount: number
    categoryId: string
    date: string
    note?: string
    myShare?: number
    originalAmount?: number
    originalCurrency?: string
    exchangeRate?: number
  }) => Promise<void>
  onDelete?: () => void
  onSettle?: () => void
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  defaultType = "expense",
  accounts,
  categories,
  onSubmit,
  onDelete,
  onSettle,
}: TransactionFormDialogProps) {
  const isEdit = !!transaction

  const [type, setType] = useState<"expense" | "income">(defaultType)
  const [amount, setAmount] = useState("")
  const [accountId, setAccountId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const [showShared, setShowShared] = useState(false)
  const [myShare, setMyShare] = useState("")
  const [showExchangeRate, setShowExchangeRate] = useState(false)
  const [exchangeRate, setExchangeRate] = useState("")
  const [originalAmount, setOriginalAmount] = useState("")
  const [originalCurrency, setOriginalCurrency] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parents = categories.filter((c) => c.parentId === null)
  const childrenByParent = categories.reduce<
    Record<string, Array<CategoryData>>
  >((acc, c) => {
    if (c.parentId !== null) {
      acc[c.parentId] = [...(acc[c.parentId] ?? []), c]
    }
    return acc
  }, {})

  useEffect(() => {
    if (open) {
      setType(
        transaction
          ? (transaction.type as "expense" | "income")
          : defaultType
      )
      setAmount(transaction ? transaction.amount.toString() : "")
      setAccountId(transaction?.accountId ?? "")
      setCategoryId(transaction?.categoryId ?? "")
      setDate(
        transaction?.date
          ? new Date(transaction.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      )
      setNote(transaction?.note ?? "")
      setShowShared(transaction?.myShare != null)
      setMyShare(transaction?.myShare?.toString() ?? "")
      setShowExchangeRate(transaction?.exchangeRate != null)
      setExchangeRate(transaction?.exchangeRate?.toString() ?? "")
      setOriginalAmount(transaction?.originalAmount?.toString() ?? "")
      setOriginalCurrency(transaction?.originalCurrency ?? "")
      setError(null)
    }
  }, [open, transaction, defaultType])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onSubmit({
        accountId,
        type,
        amount: parseFloat(amount),
        categoryId,
        date: new Date(date).toISOString(),
        ...(note ? { note } : {}),
        ...(showShared && myShare ? { myShare: parseFloat(myShare) } : {}),
        ...(showExchangeRate &&
        exchangeRate &&
        originalAmount &&
        originalCurrency
          ? {
              exchangeRate: parseFloat(exchangeRate),
              originalAmount: parseFloat(originalAmount),
              originalCurrency,
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

  const canSettle =
    isEdit && transaction.myShare != null && !transaction.settled

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Transaction" : "New Transaction"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-3">
            <div className="flex overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
                  type === "expense"
                    ? "bg-red-500/15 text-red-500"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
                  type === "income"
                    ? "bg-green-500/15 text-green-500"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Income
              </button>
            </div>

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

            <Field>
              <FieldLabel>Account</FieldLabel>
              <Select value={accountId} onValueChange={setAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {parents.map((parent) => (
                    <div key={parent.id}>
                      <SelectItem value={parent.id}>
                        {parent.icon ? `${parent.icon} ` : ""}
                        {parent.name}
                      </SelectItem>
                      {(childrenByParent[parent.id] ?? []).map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          <span className="pl-4">
                            {child.icon ? `${child.icon} ` : ""}
                            {child.name}
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </Field>

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

            <div className="flex gap-3 border-t pt-3">
              {!showShared && (
                <button
                  type="button"
                  onClick={() => setShowShared(true)}
                  className="text-xs text-primary hover:underline"
                >
                  + Shared expense
                </button>
              )}
              {!showExchangeRate && (
                <button
                  type="button"
                  onClick={() => setShowExchangeRate(true)}
                  className="text-xs text-primary hover:underline"
                >
                  + Exchange rate
                </button>
              )}
            </div>

            {showShared && (
              <div className="rounded-md border border-amber-400/30 bg-amber-400/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-amber-400">
                    Shared expense
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowShared(false)
                      setMyShare("")
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <Field>
                  <FieldLabel>My share</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={myShare}
                    onChange={(e) => setMyShare(e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
              </div>
            )}

            {showExchangeRate && (
              <div className="rounded-md border border-blue-400/30 bg-blue-400/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-400">
                    Exchange rate
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExchangeRate(false)
                      setExchangeRate("")
                      setOriginalAmount("")
                      setOriginalCurrency("")
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
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
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Original amount</FieldLabel>
                    <Input
                      type="number"
                      step="0.01"
                      value={originalAmount}
                      onChange={(e) => setOriginalAmount(e.target.value)}
                      placeholder="4152.00"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Currency</FieldLabel>
                    <Input
                      value={originalCurrency}
                      onChange={(e) =>
                        setOriginalCurrency(e.target.value.toUpperCase())
                      }
                      placeholder="UAH"
                      maxLength={3}
                    />
                  </Field>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-2">
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
                {canSettle && onSettle && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onSettle}
                    disabled={loading}
                  >
                    Mark settled
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
