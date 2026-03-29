import { config } from "dotenv"
import { expand } from "dotenv-expand"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

expand(config({ path: "../../.env" }))

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3030),
  },
  runtimeEnv: process.env,
})
