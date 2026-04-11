import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class ExchangeRateClient {
  private readonly logger = new Logger(ExchangeRateClient.name)

  async fetchRates(base: string, date: Date): Promise<Record<string, number>> {
    const dateStr = date.toISOString().split("T")[0]
    const baseLower = base.toLowerCase()

    const urls = [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/${baseLower}.min.json`,
      `https://${dateStr}.currency-api.pages.dev/v1/currencies/${baseLower}.min.json`,
    ]

    let lastError: Error | null = null

    for (const url of urls) {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status} from ${url}`)
          continue
        }

        const data = await res.json()
        const rawRates: Record<string, number> = data[baseLower]

        if (!rawRates) {
          lastError = new Error(`No rates found for ${base} in response`)
          continue
        }

        const normalized: Record<string, number> = {}
        for (const [key, value] of Object.entries(rawRates)) {
          if (typeof value === "number") {
            normalized[key.toUpperCase()] = value
          }
        }
        return normalized
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        this.logger.warn(`Failed to fetch from ${url}: ${lastError.message}`)
      }
    }

    throw lastError ?? new Error("Failed to fetch exchange rates")
  }
}
