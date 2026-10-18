import { cva } from "class-variance-authority"

import { useLocale } from "@workspace/ui/components/locale-provider"
import { moneyParts } from "@workspace/ui/lib/money"
import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

const amountVariants = cva("whitespace-nowrap tabular-nums", {
  variants: {
    size: {
      display: "font-mono text-5xl font-semibold tracking-tight",
      hero: "font-mono text-4xl font-semibold tracking-tight",
      stat: "font-heading text-[22px]/7 font-semibold tracking-tight",
      inline: "",
    },
    tone: {
      none: "",
      expense: "text-tx-expense-ink",
      income: "text-tx-income-ink",
      transfer: "text-tx-transfer-ink",
      zero: "text-muted-foreground",
    },
  },
  defaultVariants: {
    size: "inline",
    tone: "none",
  },
})

const currencyVariants = cva("font-medium text-muted-foreground", {
  variants: {
    size: {
      display: "ms-1 font-sans text-sm tracking-[0.04em]",
      hero: "ms-1 font-sans text-sm tracking-[0.04em]",
      stat: "font-sans text-xs tracking-[0.04em]",
      inline: "text-[0.8em] font-normal",
    },
  },
  defaultVariants: {
    size: "inline",
  },
})

type AmountTone = "expense" | "income" | "transfer" | "auto"

type AmountProps = Omit<React.ComponentProps<"span">, "children"> &
  Pick<VariantProps<typeof amountVariants>, "size"> & {
    value: number
    currency?: string
    signed?: boolean
    tone?: AmountTone
  }

function resolveTone(tone: AmountTone | undefined, value: number) {
  if (tone !== "auto") return tone ?? "none"
  const cents = Math.round(value * 100)
  return cents < 0 ? "expense" : cents > 0 ? "income" : "zero"
}

function Amount({
  value,
  currency,
  signed,
  tone,
  size = "inline",
  className,
  ...props
}: AmountProps) {
  const locale = useLocale()
  const { sign, whole, decimal, fraction } = moneyParts(value, {
    locale,
    signed,
  })
  return (
    <span
      data-slot="amount"
      className={cn(
        amountVariants({ size, tone: resolveTone(tone, value) }),
        className
      )}
      {...props}
    >
      {sign}
      {whole}
      <span className="opacity-50">
        {decimal}
        {fraction}
      </span>
      {currency && (
        <span className={currencyVariants({ size })}> {currency}</span>
      )}
    </span>
  )
}

export { Amount, amountVariants }
export type { AmountProps, AmountTone }
