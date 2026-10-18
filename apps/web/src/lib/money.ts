export const MINUS = "−"

export function toTypographicMinus(formatted: string): string {
  return formatted.replace("-", MINUS)
}

export function formatSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? MINUS : ""
  return sign + Math.abs(n).toFixed(2)
}
