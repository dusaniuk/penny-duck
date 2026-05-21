import * as React from "react"
import * as Flags from "country-flag-icons/react/3x2"
import {
  CURRENCIES,
  POPULAR_CURRENCY_CODES,
} from "@workspace/shared/currencies"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@workspace/ui/components/combobox"
import { cn } from "@workspace/ui/lib/utils"
import type { CurrencyInfo } from "@workspace/shared/currencies"

interface CurrencyGroup {
  label: string
  items: Array<CurrencyInfo>
}

type FlagSvgProps = React.SVGAttributes<SVGSVGElement> & { title?: string }
type FlagSvgComponent = React.ComponentType<FlagSvgProps>

const FLAG_COMPONENTS = Flags as unknown as Record<
  string,
  FlagSvgComponent | undefined
>

const POPULAR_CODE_SET = new Set<string>(POPULAR_CURRENCY_CODES)

const POPULAR_ITEMS: Array<CurrencyInfo> = POPULAR_CURRENCY_CODES.map((code) => {
  const item = CURRENCIES.find((c) => c.code === code)
  if (!item) throw new Error(`Popular currency ${code} not in CURRENCIES`)
  return item
})

const REST_ITEMS: Array<CurrencyInfo> = CURRENCIES.filter(
  (c) => !POPULAR_CODE_SET.has(c.code)
)

const GROUPED_ITEMS: Array<CurrencyGroup> = [
  { label: "Popular", items: POPULAR_ITEMS },
  { label: "", items: REST_ITEMS },
]

interface CurrencyPickerProps {
  id?: string
  value: string
  onValueChange: (code: string) => void
  disabled?: boolean
  invalid?: boolean
  portalContainer?: HTMLElement | null
  className?: string
  placeholder?: string
}

export function CurrencyPicker({
  id,
  value,
  onValueChange,
  disabled,
  invalid,
  portalContainer,
  className,
  placeholder = "Select currency",
}: CurrencyPickerProps) {
  const selectedItem = React.useMemo(
    () => CURRENCIES.find((c) => c.code === value) ?? null,
    [value]
  )

  return (
    <Combobox
      items={GROUPED_ITEMS}
      itemToStringValue={(item: CurrencyInfo) =>
        `${item.code} ${item.name} ${item.symbol}`
      }
      value={selectedItem}
      onValueChange={(item) => onValueChange(item?.code ?? "")}
      disabled={disabled}
    >
      <ComboboxTrigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-10 w-full items-center gap-2.5 rounded-[11px] border border-border bg-card px-2.5 text-left text-[13px] outline-none transition-colors hover:bg-card/80 focus-visible:border-primary/45 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive/45 [&>svg:last-child]:ml-auto",
          className
        )}
      >
        <CurrencyFlag
          country={selectedItem?.country}
          code={selectedItem?.code}
        />
        {selectedItem ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="font-semibold text-foreground">
              {selectedItem.code}
            </span>
            <span className="truncate text-muted-foreground">
              · {selectedItem.name}
            </span>
          </span>
        ) : (
          <span className="flex-1 truncate text-muted-foreground/70">
            {placeholder}
          </span>
        )}
      </ComboboxTrigger>

      <ComboboxContent container={portalContainer}>
        <ComboboxInput
          placeholder="Search currency or code..."
          showTrigger={false}
        />
        <ComboboxList className="max-h-72 overflow-y-auto p-1">
          {(group: CurrencyGroup, index: number) => (
            <React.Fragment key={group.label || `group-${index}`}>
              {index > 0 && <ComboboxSeparator />}
              <ComboboxGroup items={group.items}>
                {group.label && (
                  <ComboboxLabel className="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {group.label}
                  </ComboboxLabel>
                )}
                <ComboboxCollection>
                  {(item: CurrencyInfo) => (
                    <ComboboxItem
                      key={item.code}
                      value={item}
                      className="gap-2.5 py-1.5 pr-8 pl-2"
                    >
                      <CurrencyFlag country={item.country} code={item.code} />
                      <span className="font-semibold text-foreground">
                        {item.code}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {item.name}
                      </span>
                      <span className="ml-auto text-[12px] text-muted-foreground/80">
                        {item.symbol}
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            </React.Fragment>
          )}
        </ComboboxList>
        <ComboboxEmpty className="px-4 py-6 text-[13px]">
          No currency found.
        </ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}

interface CurrencyFlagProps {
  country: string | undefined
  code: string | undefined
}

function CurrencyFlag({ country, code }: CurrencyFlagProps) {
  const FlagComponent = country ? FLAG_COMPONENTS[country] : undefined

  if (!FlagComponent) {
    return (
      <span
        aria-hidden="true"
        className="block h-[18px] w-[26px] shrink-0 rounded-[4px] bg-foreground/8 ring-1 ring-inset ring-foreground/10"
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="block h-[18px] w-[26px] shrink-0 overflow-hidden rounded-[4px] ring-1 ring-inset ring-foreground/10"
    >
      <FlagComponent
        title={code}
        className="block size-full object-cover"
      />
    </span>
  )
}

