import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "./schema"

export function createDbClient(connectionString: string) {
  return drizzle(connectionString, { schema })
}

export type DbClient = ReturnType<typeof createDbClient>
