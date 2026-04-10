import { NestFactory } from "@nestjs/core"
import cookieParser from "cookie-parser"
import { env } from "@workspace/env/api"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.getHttpAdapter().getInstance().set("trust proxy", 1)

  app.use(cookieParser())

  app.enableCors({
    origin: env.WEB_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })

  await app.listen(env.PORT)
}

bootstrap()
