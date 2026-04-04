import { NestFactory } from "@nestjs/core"
import { ValidationPipe } from "@nestjs/common"
import cookieParser from "cookie-parser"
import { env } from "@workspace/env/api"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.use(cookieParser())

  app.enableCors({
    origin: env.WEB_URL,
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )

  await app.listen(env.PORT)
}

bootstrap()
