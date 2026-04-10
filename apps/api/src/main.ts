import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { env } from "@workspace/env/api"
import { AllExceptionsFilter } from "./all-exceptions.filter"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  })

  app.useBodyParser("json", { limit: env.MAX_BODY_SIZE_MB })
  app.useBodyParser("urlencoded", { limit: env.MAX_BODY_SIZE_MB, extended: true })

  app.getHttpAdapter().getInstance().set("trust proxy", 1)

  app.use(cookieParser())
  app.useGlobalFilters(new AllExceptionsFilter())

  app.enableCors({
    origin: env.WEB_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })

  await app.listen(env.PORT)
}

bootstrap()
