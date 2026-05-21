import { cn } from "@workspace/ui/lib/utils"
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

const CHIP_BASE_CLASS =
  "flex shrink-0 items-center gap-2 rounded-[11px] border border-foreground/[0.06] bg-card px-[11px] py-[9px] text-left transition-colors hover:bg-card/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"

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
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.id)}
              aria-pressed={active}
              className={cn(
                CHIP_BASE_CLASS,
                "max-w-[170px] min-w-[140px] sm:min-w-[150px] sm:px-3 sm:py-2.5",
                active && "border-orange-500 bg-orange-500/[0.06]"
              )}
            >
              <AccountDot color={accountDotColor(a)} />
              <AccountText account={a} />
            </button>
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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        CHIP_BASE_CLASS,
        "w-full max-w-none border-violet-500/40 sm:px-3 sm:py-2.5 dark:border-violet-300/35"
      )}
    >
      <AccountDot color={accountDotColor(account)} />
      <AccountText account={account} />
    </button>
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
