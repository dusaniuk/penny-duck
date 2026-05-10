import { isProduction } from "@workspace/env/api"

export const ACCESS_TOKEN_COOKIE = "access_token"
export const REFRESH_TOKEN_COOKIE = "refresh_token"
export const COOKIE_PATH = "/"
export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type CookieSpec = {
  name: string
  value: string
  options: {
    httpOnly: true
    secure: boolean
    sameSite: "lax"
    path: string
    maxAge: number
  }
}

function baseOptions(maxAge: number): CookieSpec["options"] {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge,
  }
}

export function accessTokenCookie(token: string): CookieSpec {
  return {
    name: ACCESS_TOKEN_COOKIE,
    value: token,
    options: baseOptions(ACCESS_TOKEN_MAX_AGE_MS),
  }
}

export function refreshTokenCookie(token: string): CookieSpec {
  return {
    name: REFRESH_TOKEN_COOKIE,
    value: token,
    options: baseOptions(REFRESH_TOKEN_MAX_AGE_MS),
  }
}
