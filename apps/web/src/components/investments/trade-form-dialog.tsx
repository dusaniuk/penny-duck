import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { InstrumentAutocomplete } from "./instrument-autocomplete"
import type { FormEvent } from "react"
import type { Account, Instrument, Trade } from "@workspace/api-contract"

type TradeType = "buy" | "sell" | "dividend"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Array<Account> // caller filters to brokerage accounts
  initial?: Trade | null
  onSubmit: (data: {
    accountId: string
    symbol: string
    type: TradeType
    quantity?: number
    price?: number
    amount?: number
    fees?: number
    date: string
  }) => Promise<void>
}

export function TradeFormDialog({
  open,
  onOpenChange,
  accounts,
  initial,
  onSubmit,
}: Props) {
  const isEdit = !!initial

  const [type, setType] = useState<TradeType>(initial?.type ?? "buy")
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? accounts[0]?.id ?? ""
  )
  const [symbol, setSymbol] = useState(initial?.symbol ?? "")
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [quantity, setQuantity] = useState(
    initial?.quantity != null ? initial.quantity.toString() : ""
  )
  const [price, setPrice] = useState(
    initial?.price != null ? initial.price.toString() : ""
  )
  const [amount, setAmount] = useState(
    initial?.amount != null ? initial.amount.toString() : ""
  )
  const [fees, setFees] = useState(
    initial?.fees != null ? initial.fees.toString() : ""
  )
  const [date, setDate] = useState(
    initial?.date
      ? initial.date.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setType(initial?.type ?? "buy")
    setAccountId(initial?.accountId ?? accounts[0]?.id ?? "")
    setSymbol(initial?.symbol ?? "")
    setInstrument(null)
    setQuantity(initial?.quantity != null ? initial.quantity.toString() : "")
    setPrice(initial?.price != null ? initial.price.toString() : "")
    setAmount(initial?.amount != null ? initial.amount.toString() : "")
    setFees(initial?.fees != null ? initial.fees.toString() : "")
    setDate(
      initial?.date
        ? initial.date.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    )
    setError(null)
  }, [open, initial, accounts])

  const isDividend = type === "dividend"

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        accountId,
        symbol,
        type,
        ...(isDividend
          ? { amount: Number(amount) }
          : { quantity: Number(quantity), price: Number(price) }),
        ...(fees ? { fees: Number(fees) } : {}),
        date: new Date(date).toISOString(),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isEdit ? "Edit trade" : "Add trade"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-3 pt-2">
            {!isEdit && (
              <Tabs value={type} onValueChange={(v) => setType(v as TradeType)}>
                <TabsList className="w-full">
                  <TabsTrigger
                    value="buy"
                    className="flex-1 data-active:bg-green-500/15 data-active:text-green-500"
                  >
                    Buy
                  </TabsTrigger>
                  <TabsTrigger
                    value="sell"
                    className="flex-1 data-active:bg-red-500/15 data-active:text-red-500"
                  >
                    Sell
                  </TabsTrigger>
                  <TabsTrigger
                    value="dividend"
                    className="flex-1 data-active:bg-blue-500/15 data-active:text-blue-500"
                  >
                    Dividend
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <Field>
              <FieldLabel>Account</FieldLabel>
              <Select value={accountId} onValueChange={setAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a brokerage account" />
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
              <FieldLabel>Symbol</FieldLabel>
              <InstrumentAutocomplete
                value={symbol}
                onChange={(s, inst) => {
                  setSymbol(s)
                  setInstrument(inst)
                }}
              />
              {instrument && (
                <p className="text-xs text-muted-foreground">
                  {instrument.name} · {instrument.exchange ?? "—"} ·{" "}
                  {instrument.currency}
                </p>
              )}
            </Field>

            <Field>
              <FieldLabel>Date</FieldLabel>
              <Input
                type="date"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>

            {!isDividend && (
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel>Quantity</FieldLabel>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Price per share</FieldLabel>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </Field>
              </div>
            )}

            {isDividend && (
              <Field>
                <FieldLabel>Amount</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </Field>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Advanced
              </summary>
              <Field className="mt-2">
                <FieldLabel>Fees</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                />
              </Field>
            </details>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : isEdit ? "Save" : "Add"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
