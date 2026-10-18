import { useState } from "react"
import { IconCheck, IconX } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import type { Account, Category, InboxItem } from "@workspace/api-contract"
import { activeCategories } from "@/lib/categories"
import { MINUS } from "@/lib/money"

export interface AcceptInput {
  accountId: string
  categoryId: string
  saveCardLabel: boolean
}

interface InboxItemCardProps {
  item: InboxItem
  accounts: Array<Account>
  categories: Array<Category>
  busy: boolean
  onAccept: (item: InboxItem, input: AcceptInput) => void
  onDismiss: (item: InboxItem) => void
}

function categoryLabel(c: Category, byId: Map<string, Category>): string {
  const parent = c.parentId ? byId.get(c.parentId) : undefined
  return parent ? `${parent.name} / ${c.name}` : c.name
}

export function InboxItemCard({
  item,
  accounts,
  categories,
  busy,
  onAccept,
  onDismiss,
}: InboxItemCardProps) {
  const [accountId, setAccountId] = useState(item.accountId ?? "")
  const [categoryId, setCategoryId] = useState("")
  const [remember, setRemember] = useState(true)

  const byId = new Map(categories.map((c) => [c.id, c]))
  const expenseCategories = activeCategories(categories)
    .filter((c) => c.type === "expense" && c.parentId !== null)
    .sort((a, b) =>
      categoryLabel(a, byId).localeCompare(categoryLabel(b, byId))
    )
  const unmatched = item.accountId === null
  const selectedAccount = accounts.find((a) => a.id === accountId)
  const accountValid = selectedAccount !== undefined
  const canRemember =
    unmatched &&
    selectedAccount?.type === "bank" &&
    selectedAccount.cardLabel === null
  const canAccept = accountValid && categoryId !== "" && !busy
  const time = new Date(item.occurredAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div
      data-testid="inbox-item"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-medium">
            {item.merchant ?? item.description ?? item.card}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {item.card} · {time}
            {item.merchant && item.description ? ` · ${item.description}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-base font-semibold text-tx-expense-ink tabular-nums">
          {MINUS}
          {item.amount.toFixed(2)}
          {item.currency ? ` ${item.currency}` : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`account-${item.id}`}>Account</FieldLabel>
          <Select
            value={accountValid ? accountId : ""}
            onValueChange={setAccountId}
          >
            <SelectTrigger
              id={`account-${item.id}`}
              aria-label="Account"
              className="w-full text-base"
            >
              <SelectValue placeholder="Choose account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`category-${item.id}`}>Category</FieldLabel>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger
              id={`category-${item.id}`}
              aria-label="Category"
              className="w-full text-base"
            >
              <SelectValue placeholder="Choose category" />
            </SelectTrigger>
            <SelectContent>
              {expenseCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {categoryLabel(c, byId)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {canRemember && (
        <Field orientation="horizontal">
          <Switch
            id={`remember-${item.id}`}
            checked={remember}
            onCheckedChange={setRemember}
          />
          <FieldContent>
            <FieldLabel htmlFor={`remember-${item.id}`}>
              Remember this card for this account
            </FieldLabel>
            <FieldDescription>
              Future taps from “{item.card}” will route here automatically.
            </FieldDescription>
          </FieldContent>
        </Field>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => onDismiss(item)}
        >
          <IconX />
          Dismiss
        </Button>
        <Button
          type="button"
          disabled={!canAccept}
          onClick={() =>
            onAccept(item, {
              accountId,
              categoryId,
              saveCardLabel: canRemember && remember,
            })
          }
        >
          <IconCheck />
          Accept
        </Button>
      </div>
    </div>
  )
}
