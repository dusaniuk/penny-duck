// Parse a YYYY-MM-DD string as a local-time Date. Using `new Date(iso)`
// parses as UTC midnight, which shifts the day for users west of UTC.
export function parseLocalDate(iso: string): Date | undefined {
  const parts = iso.split("-").map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined
  return new Date(parts[0], parts[1] - 1, parts[2])
}

export function toLocalIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
