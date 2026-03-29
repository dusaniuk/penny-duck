import { NestFactory } from "@nestjs/core"
import { env } from "@workspace/env/api"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await app.listen(env.PORT)
}
bootstrap()
