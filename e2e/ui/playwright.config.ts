import { defineConfig, devices } from "@playwright/test"
import { env } from "../shared/env"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: "html",
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: env.WEB_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter api dev",
      url: `${env.API_BASE_URL}/auth/me`,
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
    {
      command: `pnpm --filter web dev --port ${env.WEB_PORT}`,
      url: env.WEB_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...process.env,
        PORT: String(env.WEB_PORT),
        API_PROXY_TARGET: env.API_BASE_URL,
        VITE_API_URL: env.API_BASE_URL,
      },
    },
  ],
  timeout: 30_000,
  globalTimeout: 180_000,
})
