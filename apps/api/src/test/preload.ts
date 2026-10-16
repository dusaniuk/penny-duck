import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { mock } from "bun:test"
import { quoteMock, searchMock, chartMock } from "./yahoo-mock"
import { installFxApiMock } from "./fx-api-mock"

process.env.NODE_ENV ??= "test"

const repoRoot = resolve(import.meta.dir, "../../../..")

const result = spawnSync("pnpm", ["--filter", "@workspace/db", "db:migrate"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
})

if (result.status !== 0) {
  throw new Error(`Migration failed with code ${result.status}`)
}

installFxApiMock()

mock.module("yahoo-finance2", () => ({
  default: class YahooFinance {
    quote(...args: unknown[]) {
      return quoteMock(...args)
    }
    search(...args: unknown[]) {
      return searchMock(...args)
    }
    chart(...args: unknown[]) {
      return chartMock(...args)
    }
  },
}))
