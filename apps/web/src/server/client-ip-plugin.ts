import { definePlugin } from "nitro"

const CLIENT_IP_HEADER = "x-client-ip"

// The reverse proxy appends the caller's address to X-Forwarded-For, after
// anything the client sent itself, so only the right-most entry is
// trustworthy. The API trusts X-Client-IP as-is, so a client-sent one is
// always replaced.
function clientIpFrom(forwardedFor: string | null): string | undefined {
  return forwardedFor?.split(",").at(-1)?.trim() || undefined
}

export function setClientIp(event: { req: Request }): void {
  if (!new URL(event.req.url).pathname.startsWith("/api/")) return
  const { headers } = event.req
  headers.delete(CLIENT_IP_HEADER)
  const clientIp = clientIpFrom(headers.get("x-forwarded-for"))
  if (clientIp) headers.set(CLIENT_IP_HEADER, clientIp)
}

export default definePlugin((nitroApp) => {
  nitroApp.hooks?.hook("request", setClientIp)
})
