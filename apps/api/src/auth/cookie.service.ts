import { Injectable } from "@nestjs/common"
import { Response } from "express"
import {
  ACCESS_TOKEN_COOKIE,
  COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookie,
  refreshTokenCookie,
  type CookieSpec,
} from "./core/cookies"

function applySpec(res: Response, spec: CookieSpec): void {
  res.cookie(spec.name, spec.value, spec.options)
}

@Injectable()
export class CookieService {
  setAccessToken(res: Response, token: string): void {
    applySpec(res, accessTokenCookie(token))
  }

  setRefreshToken(res: Response, token: string): void {
    applySpec(res, refreshTokenCookie(token))
  }

  clearTokens(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: COOKIE_PATH })
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: COOKIE_PATH })
  }
}
