import { type FullConfig } from "@playwright/test"
import { resolve } from "node:path"
import { env } from "../shared/env"
import { truncateAll } from "../shared/db"
import { runMigrations } from "../shared/server"

async function globalSetup(_config: FullConfig): Promise<void> {
  const repoRoot = resolve(__dirname, "../..")

  await runMigrations(repoRoot, env.DATABASE_URL)
  await truncateAll()
}

export default globalSetup
