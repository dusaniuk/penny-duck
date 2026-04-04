import { config } from "dotenv"
import { expand } from "dotenv-expand"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

expand(config({ path: "../../.env" }))

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3030),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRATION: z.string().default("15m"),
    REFRESH_TOKEN_EXPIRATION: z.string().default("7d"),
    WEB_URL: z.string().url().default("http://localhost:3000"),
  },
  runtimeEnv: process.env,
})
