import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    PORT: z.coerce.number().default(3030),
    BETTER_AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    WEB_URL: z.url().default("http://localhost:3000"),
    GIT_COMMIT_SHA: z.string().optional(),
    MAX_BODY_SIZE_MB: z.coerce
      .number()
      .positive()
      .default(1)
      .transform((mb) => `${mb}mb`),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

export const isProduction = process.env.NODE_ENV === "production"
