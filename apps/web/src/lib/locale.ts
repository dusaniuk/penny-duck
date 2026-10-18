import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

const FALLBACK_LOCALE = "en-US"

export function pickLocale(acceptLanguage: string | undefined): string {
  if (!acceptLanguage) return FALLBACK_LOCALE

  const ranked = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag, ...params] = entry.trim().split(";")
      const q = params.find((p) => p.trim().startsWith("q="))
      return { tag: tag.trim(), q: q ? Number(q.trim().slice(2)) : 1 }
    })
    .filter(({ tag, q }) => tag && tag !== "*" && q > 0)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of ranked) {
    try {
      const [supported] = Intl.NumberFormat.supportedLocalesOf(tag)
      if (supported) return supported
    } catch {
      continue
    }
  }
  return FALLBACK_LOCALE
}

// The server picks the locale once and the client reuses it, so SSR and
// hydration format numbers identically.
export const getLocale = createServerFn().handler(() =>
  pickLocale(getRequestHeader("accept-language"))
)
