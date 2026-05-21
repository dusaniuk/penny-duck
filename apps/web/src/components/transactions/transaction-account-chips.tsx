import { SelectableSurface } from "@workspace/ui/components/selectable-surface"
import type { Account } from "@workspace/api-contract"
import { paletteColor } from "@/lib/palette"

// Accounts don't yet carry a palette token on the server. Derive a stable
// shade from the account id so each account gets a distinct dot color while
// being deterministic across renders and sessions. Once the schema grows an
// explicit `color` field, swap this for the stored value.
const ACCOUNT_PALETTE = [
  "orange",
  "azure",
  "emerald",
  "violet",
  "rose",
  "amber",
  "teal",
  "pink",
  "fuchsia",
  "lime",
] as const

function accountToken(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ACCOUNT_PALETTE[Math.abs(h) % ACCOUNT_PALETTE.length]
}

function accountDotColor(account: Account): string {
  return paletteColor(accountToken(account.id), { l: 0.7, c: 0.16 })
}

const SECTION_LABEL_CLASS =
  "mb-2 text-[11px] font-semibold tracking-[0.06em] uppercase text-foreground/40"

interface TransactionAccountChipsProps {
  accounts: Array<Account>
  selectedId: string
  onSelect: (id: string) => void
  label?: string
}

export function TransactionAccountChips({
  accounts,
  selectedId,
  onSelect,
  label = "From account",
}: TransactionAccountChipsProps) {
  return (
    <div className="flex flex-col">
      <div className={SECTION_LABEL_CLASS}>{label}</div>
      <div className="-mx-1 -my-1 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {accounts.map((a) => {
          const active = a.id === selectedId
          return (
            <SelectableSurface
              key={a.id}
              selected={active}
              aria-pressed={active}
              onClick={() => onSelect(a.id)}
              className="flex max-w-[170px] min-w-[140px] shrink-0 items-center gap-2 px-[11px] py-[9px] text-left sm:min-w-[150px] sm:px-3 sm:py-2.5"
            >
              <AccountDot color={accountDotColor(a)} />
              <AccountText account={a} />
            </SelectableSurface>
          )
        })}
      </div>
    </div>
  )
}

interface TransactionAccountBlockProps {
  account: Account
  onClick?: () => void
}

export function TransactionAccountBlock({
  account,
  onClick,
}: TransactionAccountBlockProps) {
  return (
    <SelectableSurface
      onClick={onClick}
      className="flex w-full items-center gap-2 border-violet-500/40 px-[11px] py-[9px] text-left sm:px-3 sm:py-2.5 dark:border-violet-300/35"
    >
      <AccountDot color={accountDotColor(account)} />
      <AccountText account={account} />
    </SelectableSurface>
  )
}

function AccountDot({ color }: { color: string }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  )
}

function AccountText({ account }: { account: Account }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-[12.5px] font-medium text-foreground">
        {account.name}
      </div>
      <div className="truncate text-[11px] text-foreground/45 tabular-nums">
        {account.balance.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}{" "}
        {account.currency}
      </div>
    </div>
  )
}
