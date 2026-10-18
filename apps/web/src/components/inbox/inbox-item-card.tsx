import { useState } from "react"
import {
  IconAlertTriangle,
  IconDots,
  IconReceipt,
  IconX,
} from "@tabler/icons-react"
import { Amount } from "@workspace/ui/components/amount"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { FormDialog } from "@workspace/ui/components/form-dialog"
import { Switch } from "@workspace/ui/components/switch"
import { useIsDark } from "@workspace/ui/hooks/use-is-dark"
import type {
  Account,
  AccountUsageItem,
  Category,
  CategoryUsageItem,
  InboxItem,
  Wallet,
} from "@workspace/api-contract"
import { AccountPicker } from "@/components/inbox/account-picker"
import { TransactionCategoryPicker } from "@/components/transactions/transaction-category-picker"
import { pickableCategories } from "@/lib/categories"
import { getIcon } from "@/lib/icons"
import { paletteColor } from "@/lib/palette"
import { suggestAccounts, suggestCategories } from "@/lib/suggestions"

export interface AcceptInput {
  accountId: string
  categoryId: string
  saveCardLabel: boolean
}

interface InboxItemCardProps {
  item: InboxItem
  accounts: Array<Account>
  wallets: Array<Wallet>
  categories: Array<Category>
  categoryUsage: ReadonlyArray<CategoryUsageItem>
  accountUsage: ReadonlyArray<AccountUsageItem>
  onAccept: (item: InboxItem, input: AcceptInput, category: Category) => void
  onDismiss: (item: InboxItem) => void
}

const SUGGESTED_CATEGORIES = 4
const SUGGESTED_ACCOUNTS = 3

const FG_OPTS_DARK = { l: 0.78, c: 0.14 } as const
const FG_OPTS_LIGHT = { l: 0.5, c: 0.18 } as const

function accountLabel(a: Account): string {
  return `${a.name} · ${a.currency}`
}

export function inboxItemTitle(item: InboxItem): string {
  return item.merchant ?? item.description ?? item.card
}

export function InboxItemCard({
  item,
  accounts,
  wallets,
  categories,
  categoryUsage,
  accountUsage,
  onAccept,
  onDismiss,
}: InboxItemCardProps) {
  const [accountId, setAccountId] = useState(item.accountId ?? "")
  const [remember, setRemember] = useState(true)
  const [picker, setPicker] = useState<"account" | "category" | null>(null)
  const isDark = useIsDark()
  const fgOpts = isDark ? FG_OPTS_DARK : FG_OPTS_LIGHT

  const byId = new Map(categories.map((c) => [c.id, c]))
  const expenseCategories = pickableCategories(categories, null).filter(
    (c) => c.type === "expense"
  )
  const suggestedCategories = suggestCategories(
    expenseCategories,
    categoryUsage,
    null,
    SUGGESTED_CATEGORIES
  )
  const suggestedAccounts = suggestAccounts(
    accounts,
    accountUsage,
    accountId,
    SUGGESTED_ACCOUNTS
  )

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const parentColor = (c: Category) =>
    c.parentId ? (byId.get(c.parentId)?.color ?? null) : c.color

  const unmatched = item.accountId === null
  const canRemember =
    unmatched &&
    selectedAccount?.type === "bank" &&
    selectedAccount.cardLabel === null
  const accept = (category: Category) =>
    onAccept(
      item,
      {
        accountId,
        categoryId: category.id,
        saveCardLabel: canRemember && remember,
      },
      category
    )
  const time = new Date(item.occurredAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div data-testid="inbox-item" className="flex flex-col gap-2.5 px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-dashed border-input text-muted-foreground"
        >
          <IconReceipt size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate font-heading text-[13.5px] font-semibold">
              {inboxItemTitle(item)}
            </p>
            {unmatched && (
              <Badge variant="outline" size="sm" className="shrink-0">
                <IconAlertTriangle className="text-warning" />
                New card
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {selectedAccount ? (
              <button
                type="button"
                onClick={() => setPicker("account")}
                aria-label={`Account: ${accountLabel(selectedAccount)}. Change`}
                className="cursor-pointer underline-offset-2 hover:text-foreground hover:underline"
              >
                {selectedAccount.name}
              </button>
            ) : (
              item.card
            )}
            {` · ${time}`}
            {item.merchant && item.description ? ` · ${item.description}` : ""}
          </p>
        </div>
        <Amount
          value={-item.amount}
          tone="expense"
          currency={item.currency ?? undefined}
          className="shrink-0 text-sm font-semibold"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onDismiss(item)}
          aria-label="Dismiss"
          className="text-muted-foreground"
        >
          <IconX />
        </Button>
      </div>

      {canRemember && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground sm:pl-12">
          <Switch
            size="sm"
            checked={remember}
            onCheckedChange={setRemember}
            aria-label="Remember this card"
          />
          Remember “{item.card}” for {selectedAccount.name}
        </label>
      )}

      <div className="flex flex-wrap items-center gap-1.5 sm:pl-12">
        {selectedAccount ? (
          <>
            {suggestedCategories.map((c) => {
              const icon = getIcon(c.icon)
              return (
                <Badge key={c.id} asChild variant="outline" size="lg">
                  <button type="button" onClick={() => accept(c)}>
                    {icon && (
                      <icon.component
                        style={{ color: paletteColor(parentColor(c), fgOpts) }}
                      />
                    )}
                    {c.name}
                  </button>
                </Badge>
              )
            })}
            <MoreChip
              label="More categories"
              onClick={() => setPicker("category")}
            />
          </>
        ) : (
          <>
            <span className="mr-0.5 text-xs text-muted-foreground">
              Account
            </span>
            {suggestedAccounts.map((a) => (
              <Badge key={a.id} asChild variant="outline" size="lg">
                <button type="button" onClick={() => setAccountId(a.id)}>
                  {accountLabel(a)}
                </button>
              </Badge>
            ))}
            <MoreChip
              label="More accounts"
              onClick={() => setPicker("account")}
            />
          </>
        )}
      </div>

      <FormDialog
        open={picker === "category"}
        onOpenChange={(open) => !open && setPicker(null)}
        title="Select category"
      >
        {(ctx) => (
          <div className={ctx.shellClass}>
            <TransactionCategoryPicker
              categories={expenseCategories}
              selectedId={null}
              recentIds={[]}
              onSelect={(id) => {
                ctx.close()
                const category = byId.get(id)
                if (category) accept(category)
              }}
              onClose={ctx.close}
              variant={ctx.isMobile ? "mobile" : "desktop"}
            />
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={picker === "account"}
        onOpenChange={(open) => !open && setPicker(null)}
        title="Select account"
      >
        {(ctx) => (
          <div className={ctx.shellClass}>
            <AccountPicker
              accounts={accounts}
              wallets={wallets}
              selectedId={accountId}
              onSelect={(id) => {
                setAccountId(id)
                ctx.close()
              }}
              onClose={ctx.close}
              variant={ctx.isMobile ? "mobile" : "desktop"}
            />
          </div>
        )}
      </FormDialog>
    </div>
  )
}

function MoreChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Badge asChild variant="ghost" size="lg" className="text-muted-foreground">
      <button type="button" onClick={onClick} aria-label={label}>
        <IconDots />
        More
      </button>
    </Badge>
  )
}
