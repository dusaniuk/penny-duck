import type { Context } from "hono"
import { auth } from "./auth"

export async function clearSessionCookies(c: Context): Promise<void> {
  const { authCookies } = await auth.$context
  for (const cookie of [
    authCookies.sessionToken,
    authCookies.sessionData,
    authCookies.dontRememberToken,
  ]) {
    const secure = cookie.attributes.secure ? "; Secure" : ""
    c.header(
      "set-cookie",
      `${cookie.name}=; Path=${cookie.attributes.path ?? "/"}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
      { append: true }
    )
  }
}
