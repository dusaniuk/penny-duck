import { sql } from "drizzle-orm"
import { createDbClient, type DbClient } from "@workspace/db"
import { env } from "./env"

let db: DbClient | null = null

export function getDb(): DbClient {
  if (!db) {
    db = createDbClient(env.DATABASE_URL)
  }
  return db
}

export async function truncateAll(): Promise<void> {
  if (!env.DATABASE_URL.includes("test")) {
    throw new Error(
      "Refusing to truncate: DATABASE_URL does not contain 'test'"
    )
  }
  const db = getDb()
  await db.execute(
    sql`TRUNCATE app.wallet_inbox, app.trades, app.instruments, app.transactions, app.categories, app.accounts, auth.verifications, auth.apikeys, app.users CASCADE`,
  )
}

export async function seedInstrument(data: {
  symbol: string
  name: string
  exchange?: string | null
  currency: string
  lastPrice: number
}): Promise<{ id: string; symbol: string }> {
  if (!env.DATABASE_URL.includes("test")) {
    throw new Error(
      "Refusing to seed: DATABASE_URL does not contain 'test'"
    )
  }
  const db = getDb()
  const result = await db.execute(sql`
    INSERT INTO app.instruments (symbol, name, exchange, currency, last_price, last_priced_at)
    VALUES (
      ${data.symbol.toUpperCase()},
      ${data.name},
      ${data.exchange ?? null},
      ${data.currency},
      ${data.lastPrice},
      NOW()
    )
    ON CONFLICT (symbol) DO UPDATE SET
      last_price = EXCLUDED.last_price,
      last_priced_at = NOW()
    RETURNING id, symbol
  `)
  const row = result.rows[0] as { id: string; symbol: string }
  return row
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.$client.end()
    db = null
  }
}
