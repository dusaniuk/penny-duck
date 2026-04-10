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
    RAILWAY_ENVIRONMENT_NAME: z.string().optional(),
    MAX_BODY_SIZE_MB: z.coerce
      .number()
      .positive()
      .default(1)
      .transform((mb) => `${mb}mb`),
  },
  runtimeEnv: process.env,
})

export const isProduction = env.RAILWAY_ENVIRONMENT_NAME === "production"
