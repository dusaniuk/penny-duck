import { Controller, Get } from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import { AppService } from "./app.service"

@Controller()
@SkipThrottle()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("healthcheck")
  getHealth() {
    return this.appService.getHealth()
  }
}
