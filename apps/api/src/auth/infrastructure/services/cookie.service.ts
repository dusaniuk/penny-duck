import { Injectable } from "@nestjs/common"
import { Response } from "express"
import { isProduction } from "@workspace/env/api"

@Injectable()
export class CookieService {
  setAccessToken(res: Response, token: string): void {
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60 * 1000,
    })
  }

  setRefreshToken(res: Response, token: string): void {
    res.cookie("refresh_token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  }

  clearTokens(res: Response): void {
    res.clearCookie("access_token", { path: "/" })
    res.clearCookie("refresh_token", { path: "/" })
  }
}
