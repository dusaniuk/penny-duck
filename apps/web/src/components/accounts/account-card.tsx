import { IconChevronRight, IconCreditCard } from "@tabler/icons-react"
import { useNavigate } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { useId } from "react"
import type { CSSProperties } from "react"
import type { Account, WalletPocket } from "@workspace/api-contract"
import { getIcon } from "@/lib/icons"
import { paletteColor } from "@/lib/palette"

// AccountCard handles bank/brokerage (single currency) and wallet (multiple
// currency pockets) entries with the same visual frame. When `pockets` is
// set, the balance line renders one `amount currency` pair per pocket and
// the "Set default" action is hidden (wallets can't be the default account).
// The sparkline for wallets is in home currency, summed from pocket series.
export type AccountData = Account & { pockets?: ReadonlyArray<WalletPocket> }

interface AccountCardProps {
  account: AccountData
  series: Array<number> | undefined
  onEdit: (account: AccountData) => void
  onSetDefault: (account: AccountData) => void
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function BalanceSparkline({
  color,
  values,
  height = 32,
  className,
}: {
  color: string
  values: Array<number>
  height?: number
  className?: string
}) {
  const width = 200
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = Math.max(0.01, max - min)
  const step = width / Math.max(1, values.length - 1)
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4)
  const d = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${y(v).toFixed(1)}`
    )
    .join(" ")

  const area = `${d} L ${width} ${height} L 0 ${height} Z`
  const reactId = useId()
  const gradientId = `spk-${reactId}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Balance trend, last 30 days"
      className={cn("block w-full", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} aria-hidden />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        aria-hidden
      />
    </svg>
  )
}

function AccountIconChip({
  color,
  icon,
}: {
  color: string | null
  icon: string | null
}) {
  const fgLight = paletteColor(color, { l: 0.5, c: 0.18 })
  const fgDark = paletteColor(color, { l: 0.78, c: 0.14 })
  const bgLight = paletteColor(color, { l: 0.93, c: 0.1 })
  const bgDark = paletteColor(color, { l: 0.42, c: 0.1, a: 0.18 })
  const def = getIcon(icon)
  const Icon = def?.component ?? IconCreditCard

  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-foreground/5 bg-(--chip-bg-l) text-(--chip-fg-l) dark:bg-(--chip-bg-d) dark:text-(--chip-fg-d)"
      style={
        {
          "--chip-fg-l": fgLight,
          "--chip-fg-d": fgDark,
          "--chip-bg-l": bgLight,
          "--chip-bg-d": bgDark,
        } as CSSProperties
      }
    >
      <Icon className="size-[18px]" />
    </span>
  )
}

export function AccountCard({
  account,
  series,
  onEdit,
  onSetDefault,
}: AccountCardProps) {
  const navigate = useNavigate()
  const isBrokerage = account.type === "brokerage"
  const isWallet = !!account.pockets
  const isLoan = account.type === "loan"
  const sparkColor = paletteColor(account.color, { l: 0.78, c: 0.14 })

  return (
    <Card
      className={cn(
        "group relative gap-3 overflow-hidden p-4 transition-[box-shadow,--tw-ring-color] hover:shadow-md hover:ring-primary/40",
        account.isDefault && "ring-primary/60"
      )}
    >
      {/* Mobile: horizontal row, entire card opens edit */}
      <button
        type="button"
        onClick={() => onEdit(account)}
        className="-m-4 flex items-center gap-3 rounded-xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:hidden"
      >
        <AccountIconChip color={account.color} icon={account.icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-heading text-base font-semibold">
              {account.name}
            </p>
            {account.isDefault && (
              <Badge
                variant="secondary"
                className="h-4 shrink-0 bg-primary/10 px-1.5 text-[9px] font-semibold tracking-[0.08em] text-primary uppercase"
              >
                Default
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground lowercase">
            {isWallet
              ? `${account.type} · ${account.pockets!.length} ${account.pockets!.length === 1 ? "currency" : "currencies"}`
              : `${account.type} · ${account.currency}`}
          </p>
        </div>
        <div className="shrink-0 text-right tabular-nums">
          {isWallet ? (
            <div className="flex flex-col items-end gap-0.5 text-[13px] font-semibold leading-tight">
              {account.pockets!.length === 0 ? (
                <span className="text-[11px] font-normal text-muted-foreground">
                  empty
                </span>
              ) : (
                account.pockets!.map((p) => (
                  <span key={p.currency}>
                    {fmtMoney(p.balance)}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {p.currency}
                    </span>
                  </span>
                ))
              )}
            </div>
          ) : (
            <>
              <p
                className={cn(
                  "font-heading text-lg font-semibold tracking-tight",
                  isLoan && "text-amber-600 dark:text-amber-400"
                )}
              >
                {fmtMoney(account.balance)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isLoan ? `${account.currency} · Owed` : account.currency}
              </p>
            </>
          )}
        </div>
        <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Desktop: stacked layout with sparkline + hover actions */}
      <CardHeader className="hidden flex-row items-start gap-2.5 p-0 sm:flex">
        <AccountIconChip color={account.color} icon={account.icon} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground lowercase">
            <span>{account.type}</span>
            {!isWallet && (
              <>
                <span className="opacity-50">·</span>
                <span>{account.currency}</span>
              </>
            )}
            {isWallet && (
              <>
                <span className="opacity-50">·</span>
                <span>
                  {account.pockets!.length}{" "}
                  {account.pockets!.length === 1 ? "currency" : "currencies"}
                </span>
              </>
            )}
            {account.isDefault && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 bg-primary/10 px-1.5 text-[9px] font-semibold tracking-[0.08em] text-primary uppercase"
              >
                Default
              </Badge>
            )}
          </p>
          <p className="mt-0.5 truncate font-heading text-sm font-semibold">
            {account.name}
          </p>
        </div>
      </CardHeader>
      <CardContent className="hidden space-y-3 p-0 sm:block">
        {isWallet ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
            {account.pockets!.length === 0 ? (
              <span className="text-[12px] text-muted-foreground/70">
                No currencies yet — edit to add one.
              </span>
            ) : (
              account.pockets!.map((p) => (
                <span
                  key={p.currency}
                  className="flex items-baseline gap-1"
                >
                  <span className="font-heading text-[18px] font-semibold tracking-tight">
                    {fmtMoney(p.balance)}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {p.currency}
                  </span>
                </span>
              ))
            )}
          </div>
        ) : (
          <p className="flex items-baseline gap-1.5 tabular-nums">
            <span
              className={cn(
                "font-heading text-[22px] font-semibold tracking-tight",
                isLoan && "text-amber-600 dark:text-amber-400"
              )}
            >
              {fmtMoney(account.balance)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {isLoan ? `${account.currency} · Owed` : account.currency}
            </span>
          </p>
        )}
        <div className="space-y-1 transition-opacity duration-150 group-focus-within:opacity-15 group-hover:opacity-15">
          {series && series.length > 1 ? (
            <BalanceSparkline color={sparkColor} values={series} />
          ) : (
            <div className="h-8 w-full animate-pulse rounded bg-muted/60" />
          )}
          <p className="font-mono text-[9.5px] tracking-widest text-muted-foreground/70 uppercase">
            {isLoan ? "debt remaining · last 30 days" : "last 30 days"}
          </p>
        </div>
      </CardContent>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 hidden translate-y-1.5 gap-1.5 opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 sm:flex">
        <Button
          type="button"
          size="xs"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(account)
          }}
        >
          Edit
        </Button>
        {!account.isDefault && !isWallet && !isLoan && (
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              onSetDefault(account)
            }}
          >
            Set default
          </Button>
        )}
        {isBrokerage && (
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              void navigate({
                to: "/investments/$accountId",
                params: { accountId: account.id },
              })
            }}
          >
            View investments
          </Button>
        )}
      </div>
    </Card>
  )
}
