import { config } from "dotenv"
import { expand } from "dotenv-expand"
import { resolve } from "node:path"

expand(
  config({ path: resolve(__dirname, "../../../../.env.test"), override: true })
)
