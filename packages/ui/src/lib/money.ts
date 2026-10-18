export const MINUS = "−"

export type MoneySign = "" | "+" | typeof MINUS

export type MoneyParts = {
  sign: MoneySign
  whole: string
  decimal: string
  fraction: string
}

export type MoneyFormatOptions = {
  locale?: string
  signed?: boolean
}

export function moneyParts(
  value: number,
  { locale, signed = false }: MoneyFormatOptions = {}
): MoneyParts {
  const cents = Math.round(value * 100)
  const sign: MoneySign = cents < 0 ? MINUS : cents > 0 && signed ? "+" : ""

  const parts = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(Math.abs(cents) / 100)

  let whole = ""
  let decimal = "."
  let fraction = "00"
  for (const part of parts) {
    if (part.type === "decimal") decimal = part.value
    else if (part.type === "fraction") fraction = part.value
    else if (part.type === "integer" || part.type === "group")
      whole += part.value
  }

  return { sign, whole, decimal, fraction }
}

export function formatMoney(
  value: number,
  options: MoneyFormatOptions & { currency?: string } = {}
): string {
  const { sign, whole, decimal, fraction } = moneyParts(value, options)
  const figure = `${sign}${whole}${decimal}${fraction}`
  return options.currency ? `${figure} ${options.currency}` : figure
}
