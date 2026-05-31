import {
  IconChevronRight,
  IconCreditCard,
  IconPlus,
  IconReceipt2,
  IconSparkles,
  IconTrendingUp,
  IconWallet,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import type { PaletteColor } from "@/lib/palette"
import { paletteColor } from "@/lib/palette"

type AccountType = "bank" | "wallet" | "brokerage" | "loan"

interface AccountEmptyStateProps {
  onAdd: () => void
  onAddWithType: (type: AccountType) => void
}

interface Pick {
  type: AccountType
  title: string
  sub: string
  Icon: typeof IconCreditCard
  color: PaletteColor
}

const PICKS: ReadonlyArray<Pick> = [
  {
    type: "bank",
    title: "Bank",
    sub: "Checking, savings, debit cards",
    Icon: IconCreditCard,
    color: "orange",
  },
  {
    type: "wallet",
    title: "Wallet",
    sub: "Physical cash, multiple currencies",
    Icon: IconWallet,
    color: "green",
  },
  {
    type: "brokerage",
    title: "Brokerage",
    sub: "Stocks, ETFs, retirement",
    Icon: IconTrendingUp,
    color: "violet",
  },
  {
    type: "loan",
    title: "Loan",
    sub: "Track money you owe",
    Icon: IconReceipt2,
    color: "red",
  },
]

export function AccountEmptyState({
  onAdd,
  onAddWithType,
}: AccountEmptyStateProps) {
  return (
    <div className="space-y-8">
      <Hero onAdd={onAdd} />
      <div className="space-y-4">
        <SectionHeader>Start with</SectionHeader>
        <QuickPicks onPick={onAddWithType} />
        <Tip />
      </div>
    </div>
  )
}

function Hero({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="grid grid-cols-1 items-center gap-6 rounded-2xl p-6 md:grid-cols-[minmax(220px,1fr)_1.4fr] md:gap-9 md:p-8">
      <div className="flex justify-center">
        <GhostCardsIllustration className="md:hidden" size={172} />
        <GhostCardsIllustration className="hidden md:block" size={260} />
      </div>
      <div className="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
          Get started
        </p>
        <h2 className="font-heading text-xl font-semibold tracking-tight md:text-[26px]">
          Set up your first account
        </h2>
        <p className="max-w-[46ch] text-[13.5px] leading-[1.55] text-muted-foreground">
          Add the places your money lives — banks, cash, brokerages. Penny Duck
          rolls them up into one net worth, in any currency.
        </p>
        <Button onClick={onAdd} className="mt-1 w-full md:w-auto">
          <IconPlus className="size-4" />
          Add your first account
        </Button>
      </div>
    </Card>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="font-mono text-[10.5px] tracking-widest text-muted-foreground/70 uppercase">
        {children}
      </span>
      <span className="h-px flex-1 bg-linear-to-r from-border to-transparent" />
    </div>
  )
}

function QuickPicks({ onPick }: { onPick: (type: AccountType) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {PICKS.map((p) => (
        <QuickPickTile key={p.type} pick={p} onPick={onPick} />
      ))}
    </div>
  )
}

function QuickPickTile({
  pick,
  onPick,
}: {
  pick: Pick
  onPick: (type: AccountType) => void
}) {
  const fg = paletteColor(pick.color, { l: 0.78, c: 0.14 })
  const tint = paletteColor(pick.color, { l: 0.42, c: 0.1, a: 0.18 })
  const Icon = pick.Icon
  return (
    <button
      type="button"
      onClick={() => onPick(pick.type)}
      className={cn(
        "group/pick flex items-center gap-3 rounded-[14px] border border-border bg-card p-4 text-left transition",
        "hover:-translate-y-px hover:border-foreground/15 hover:shadow-sm",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      )}
    >
      <span
        className="grid size-[38px] shrink-0 place-items-center rounded-[10px] border border-foreground/4"
        style={{ color: fg, background: tint }}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold text-foreground">
          {pick.title}
        </p>
        <p className="truncate text-[11.5px] text-muted-foreground">
          {pick.sub}
        </p>
      </div>
      <span
        aria-hidden
        className="hidden size-6 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition group-hover/pick:border-foreground/20 group-hover/pick:text-foreground md:grid"
      >
        <IconPlus className="size-3.5" />
      </span>
      <IconChevronRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground md:hidden"
      />
    </button>
  )
}

function Tip() {
  return (
    <p className="inline-flex items-center gap-2 px-1 text-[11.5px] text-muted-foreground">
      <span className="grid size-5 shrink-0 place-items-center rounded bg-muted">
        <IconSparkles className="size-3" />
      </span>
      <span className="hidden md:inline">
        Any currency works — Penny Duck converts on the fly so net worth always
        shows in your home currency.
      </span>
      <span className="md:hidden">Any currency — we convert on the fly.</span>
    </p>
  )
}

function GhostCardsIllustration({
  size = 220,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 144"
      width={size}
      height={(size * 144) / 200}
      className={cn("text-foreground", className)}
      fill="none"
    >
      <g transform="translate(28 30) rotate(-8 70 42)">
        <rect
          width="124"
          height="84"
          rx="10"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1.25"
        />
      </g>
      <g transform="translate(48 22) rotate(7 70 42)">
        <rect
          width="124"
          height="84"
          rx="10"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.25"
        />
        <g transform="translate(14 16)" className="text-primary">
          <rect width="16" height="12" rx="2.5" fill="currentColor" />
          <path
            d="M0 4 H16 M0 8 H16 M5.5 0 V12 M10.5 0 V12"
            stroke="var(--primary-foreground)"
            strokeOpacity="0.28"
            strokeWidth="0.6"
          />
        </g>
      </g>
    </svg>
  )
}
