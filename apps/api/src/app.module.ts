import { Module } from "@nestjs/common"
import { DatabaseModule } from "./database/database.module"
import { AuthModule } from "./auth/auth.module"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
