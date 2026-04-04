import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Button } from "@workspace/ui/components/button"
import type { AccountData } from "@/components/accounts/account-card"

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: AccountData | null
  onSubmit: (data: {
    name: string
    type: string
    currency: string
    balance?: number
  }) => Promise<void>
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
}: AccountFormDialogProps) {
  const isEdit = !!account

  const [name, setName] = useState("")
  const [type, setType] = useState("bank")
  const [currency, setCurrency] = useState("")
  const [balance, setBalance] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(account?.name ?? "")
      setType(account?.type ?? "bank")
      setCurrency(account?.currency ?? "")
      setBalance("")
      setError(null)
    }
  }, [open, account])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onSubmit({
        name,
        type,
        currency,
        ...(!isEdit && balance !== "" ? { balance: parseFloat(balance) } : {}),
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Account" : "New Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Checking"
                required
              />
            </Field>

            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Currency</FieldLabel>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={3}
                required
                disabled={isEdit}
              />
            </Field>

            {!isEdit && (
              <Field>
                <FieldLabel>Initial Balance</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00"
                />
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
                {loading ? "Saving…" : isEdit ? "Save Changes" : "Create"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
