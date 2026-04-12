import { defineConfig } from "@playwright/test"
import { env } from "../shared/env"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: "html",
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: env.API_BASE_URL,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
  webServer: {
    command: "pnpm --filter api dev",
    url: `${env.API_BASE_URL}/users/me`,
    // API returns 401 for /users/me when no token — that's expected and means it's ready
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      PORT: String(env.API_PORT),
      DATABASE_URL: env.DATABASE_URL,
      WEB_URL: env.WEB_BASE_URL,
    },
  },
  timeout: 30_000,
  globalTimeout: 120_000,
})
