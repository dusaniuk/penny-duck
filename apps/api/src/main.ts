import { serve } from "@hono/node-server"
import { env } from "@workspace/env/api"
import { honoApp } from "./hono/app"

serve({ fetch: honoApp.fetch, port: env.PORT }, ({ port }) => {
  console.log(`api listening on :${port}`)
})
