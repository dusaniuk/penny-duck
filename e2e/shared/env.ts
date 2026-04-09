import { config } from "dotenv"
import { expand } from "dotenv-expand"
import { resolve } from "node:path"

expand(config({ path: resolve(__dirname, "../../.env.test"), override: true }))

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check .env.test exists at the repo root.")
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  API_PORT: Number(process.env.PORT ?? 4030),
  API_BASE_URL: process.env.API_URL ?? "http://localhost:4030",
  WEB_PORT: Number(process.env.WEB_PORT ?? 4000),
  WEB_BASE_URL: process.env.WEB_URL ?? "http://localhost:4000",
}
