import { NestFactory } from "@nestjs/core"
import { ExpressAdapter, NestExpressApplication } from "@nestjs/platform-express"
import { getRequestListener } from "@hono/node-server"
import express from "express"
import cookieParser from "cookie-parser"
import cors from "cors"
import { env } from "@workspace/env/api"
import { AllExceptionsFilter } from "./all-exceptions.filter"
import { AppModule } from "./app.module"
import { honoApp } from "./hono/app"
import { MIGRATED_PREFIXES } from "./hono/migrated-prefixes"

async function bootstrap() {
  const expressApp = express()

  expressApp.set("trust proxy", 1)
  expressApp.use(
    cors({
      origin: env.WEB_URL,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type"],
    }),
  )
  expressApp.use(cookieParser())

  // Hono routes own their own body stream — must run before express.json().
  const honoListener = getRequestListener(honoApp.fetch)
  expressApp.use((req, res, next) => {
    if (MIGRATED_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
      return honoListener(req, res)
    }
    next()
  })

  expressApp.use(express.json({ limit: env.MAX_BODY_SIZE_MB }))
  expressApp.use(express.urlencoded({ limit: env.MAX_BODY_SIZE_MB, extended: true }))

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
    { bodyParser: false },
  )
  app.useGlobalFilters(new AllExceptionsFilter())

  await app.listen(env.PORT)
}

bootstrap()
