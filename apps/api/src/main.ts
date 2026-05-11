import { env } from "@workspace/env/api"
import { honoApp } from "./app"

console.log(`api listening on :${env.PORT}`)

export default {
  port: env.PORT,
  fetch: honoApp.fetch,
}
