import { Injectable } from "@nestjs/common"
import * as svc from "@/hono/modules/exchange-rates/service"

@Injectable()
export class ExchangeRateService {
  getRate = svc.getRate
  getLatestRates = svc.getLatestRates
}
