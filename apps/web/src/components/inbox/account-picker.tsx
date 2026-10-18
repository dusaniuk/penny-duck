import { useState } from "react"
import { IconSearch, IconX } from "@tabler/icons-react"
import { Amount } from "@workspace/ui/components/amount"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { SelectableSurface } from "@workspace/ui/components/selectable-surface"
import { cn } from "@workspace/ui/lib/utils"
import type { Account, Wallet } from "@workspace/api-contract"
import {
  AccountDot,
  AccountText,
} from "@/components/transactions/transaction-account-chips"
import { paletteColor } from "@/lib/palette"

const ICON_BTN_CLASS =
  "size-7.5 bg-transparent text-muted-foreground hover:bg-foreground/6 hover:text-foreground"

const GROUP_LABEL =
  "text-[10.5px] font-semibold tracking-[0.08em] text-foreground/45 uppercase"

interface AccountPickerProps {
  accounts: Array<Account>
  wallets: Array<Wallet>
  selectedId: string
  onSelect: (id: string) => void
  onClose: () => void
  variant?: "desktop" | "mobile"
}

export function AccountPicker({
  accounts,
  wallets,
  selectedId,
  onSelect,
  onClose,
  variant = "desktop",
}: AccountPickerProps) {
  const [search, setSearch] = useState("")
  const q = search.trim().toLowerCase()
  const matches = (...texts: Array<string>) =>
    q === "" || texts.some((t) => t.toLowerCase().includes(q))

  const standalone = accounts.filter(
    (a) => a.walletId === null && matches(a.name, a.currency)
  )
  const walletGroups = wallets.flatMap((wallet) => {
    const pockets = accounts
      .filter(
        (a) => a.walletId === wallet.id && matches(wallet.name, a.currency)
      )
      .sort((a, b) => a.currency.localeCompare(b.currency))
    return pockets.length > 0 ? [{ wallet, pockets }] : []
  })

  const gridCols = variant === "mobile" ? "grid-cols-1" : "grid-cols-2"
  const bodyMaxH = variant === "mobile" ? "max-h-[600px]" : "max-h-[540px]"
  const nothingFound = standalone.length === 0 && walletGroups.length === 0

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden className="size-7.5" />
        <div className="flex-1 text-center font-heading text-[14px] font-semibold text-foreground">
          Select account
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close"
          className={ICON_BTN_CLASS}
        >
          <IconX size={16} />
        </Button>
      </div>

      <InputGroup className="h-auto rounded-[11px] border-foreground/6 bg-foreground/4 px-3 py-2.5 [&_input]:text-base [&_input]:text-foreground [&_input]:placeholder:text-foreground/35">
        <InputGroupAddon align="inline-start" className="text-foreground/40">
          <IconSearch size={15} />
        </InputGroupAddon>
        <InputGroupInput
          autoFocus
          placeholder="Search accounts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <InputGroupAddon align="inline-end">
            <button
              type="button"
              className="grid size-4.5 place-items-center rounded-full border-0 bg-foreground/10 text-foreground/70"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <IconX size={12} />
            </button>
          </InputGroupAddon>
        )}
      </InputGroup>

      <div
        className={cn(
          "-mx-1 flex scrollbar-none flex-col gap-3.5 overflow-y-auto px-1 pb-1 [&::-webkit-scrollbar]:w-0",
          bodyMaxH
        )}
      >
        {standalone.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className={GROUP_LABEL}>Accounts</span>
            <div className={cn("grid gap-1.5", gridCols)}>
              {standalone.map((account) => {
                const active = account.id === selectedId
                const color = paletteColor(account.color, { l: 0.7, c: 0.16 })
                return (
                  <SelectableSurface
                    key={account.id}
                    aria-pressed={active}
                    onClick={() => onSelect(account.id)}
                    className="flex items-center gap-2 px-3 py-2.5 text-left"
                    style={active ? { borderColor: color } : undefined}
                  >
                    <AccountDot color={color} />
                    <AccountText account={account} />
                  </SelectableSurface>
                )
              })}
            </div>
          </div>
        )}

        {walletGroups.map(({ wallet, pockets }) => {
          const color = paletteColor(wallet.color, { l: 0.7, c: 0.16 })
          return (
            <div key={wallet.id} className="flex flex-col gap-1.5">
              <div
                className="flex items-center gap-2 rounded-[9px] border border-foreground/5 bg-foreground/2.5 px-2.75 py-2 text-[13px] font-medium text-foreground"
                role="presentation"
              >
                <AccountDot color={color} />
                <span className="flex-1">{wallet.name}</span>
                <Badge
                  size="sm"
                  variant="secondary"
                  className="border-0 bg-foreground/5 text-foreground/40"
                >
                  {pockets.length}
                </Badge>
              </div>
              <div
                className={cn(
                  "relative grid gap-1.5 pl-5.5 before:absolute before:inset-y-1 before:left-2.5 before:w-px before:bg-foreground/[0.07] before:content-['']",
                  gridCols
                )}
              >
                {pockets.map((pocket) => {
                  const active = pocket.id === selectedId
                  return (
                    <SelectableSurface
                      key={pocket.id}
                      aria-pressed={active}
                      aria-label={`${wallet.name} ${pocket.currency}`}
                      onClick={() => onSelect(pocket.id)}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-left"
                      style={active ? { borderColor: color } : undefined}
                    >
                      <span className="text-[12.5px] font-medium text-foreground">
                        {pocket.currency}
                      </span>
                      <Amount
                        value={pocket.balance}
                        className="truncate text-[11px] text-foreground/45"
                      />
                    </SelectableSurface>
                  )
                })}
              </div>
            </div>
          )
        })}

        {nothingFound && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No accounts match “{search.trim()}”
          </p>
        )}
      </div>
    </>
  )
}
