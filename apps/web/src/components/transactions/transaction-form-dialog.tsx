import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
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
import type { Account, Category, Transaction } from "@workspace/api-contract"
import { getCategoryIcon } from "@/lib/category-icons"

type AccountData = Account
type CategoryData = Category
type TransactionData = Transaction

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
    settled?: boolean
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
  const [unsettled, setUnsettled] = useState(false)
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
          ? transaction.type
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
      setUnsettled(transaction ? !transaction.settled : false)
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
        ...(!isEdit && unsettled ? { settled: false } : {}),
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

  const canToggleSettle = isEdit && onSettle

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isEdit ? "Edit Transaction" : "New Transaction"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
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
                      {a.name} — {a.balance.toFixed(2)} {a.currency}
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
                  {parents.map((parent) => {
                    const parentIcon = getCategoryIcon(parent.icon)
                    return (
                      <div key={parent.id}>
                        <SelectItem value={parent.id}>
                          <span className="flex items-center gap-1.5">
                            {parentIcon ? (
                              <parentIcon.component className="size-4" />
                            ) : parent.icon ? (
                              parent.icon
                            ) : null}
                            {parent.name}
                          </span>
                        </SelectItem>
                        {(childrenByParent[parent.id] ?? []).map((child) => {
                          const childIcon = getCategoryIcon(child.icon)
                          return (
                            <SelectItem key={child.id} value={child.id}>
                              <span className="flex items-center gap-1.5 pl-4">
                                {childIcon ? (
                                  <childIcon.component className="size-4" />
                                ) : child.icon ? (
                                  child.icon
                                ) : null}
                                {child.name}
                              </span>
                            </SelectItem>
                          )
                        })}
                      </div>
                    )
                  })}
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
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setUnsettled(!unsettled)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    unsettled
                      ? "border-amber-400 bg-amber-400/20 text-amber-400"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {unsettled ? "Unsettled" : "Mark unsettled"}
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
                {canToggleSettle && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onSettle}
                    disabled={loading}
                  >
                    {transaction.settled ? "Mark unsettled" : "Mark settled"}
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
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
