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
  await db.execute(sql`TRUNCATE app.refresh_tokens, app.users CASCADE`)
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.$client.end()
    db = null
  }
}
