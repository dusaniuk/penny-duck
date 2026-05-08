import { createDbClient, type DbClient } from "@workspace/db"
import { env } from "@workspace/env/api"

export const db: DbClient = createDbClient(env.DATABASE_URL)
