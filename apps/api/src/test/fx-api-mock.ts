// Units of each currency per 1 USD; cross rates are derived from these.
const USD_RATES: Record<string, number> = {
  usd: 1,
  eur: 0.9,
  uah: 41,
  pln: 3.9,
  gbp: 0.78,
  chf: 0.88,
}

const FX_API_HOSTS = /(^|\.)cdn\.jsdelivr\.net$|(^|\.)currency-api\.pages\.dev$/

function fxResponse(url: URL): Response {
  const base = url.pathname.match(
    /\/currencies\/([a-z]+)(?:\.min)?\.json$/
  )?.[1]
  const baseRate = base ? USD_RATES[base] : undefined
  if (!base || baseRate === undefined) {
    return new Response("Not Found", { status: 404 })
  }
  const rates = Object.fromEntries(
    Object.entries(USD_RATES).map(([code, rate]) => [code, rate / baseRate])
  )
  return Response.json({ date: "fixture", [base]: rates })
}

const realFetch = globalThis.fetch

export function installFxApiMock() {
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input)
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return realFetch(input, init)
      }
      if (FX_API_HOSTS.test(url.hostname)) return fxResponse(url)
      throw new Error(`Unexpected network request in tests: ${url.href}`)
    },
    { preconnect: realFetch.preconnect }
  )
}
