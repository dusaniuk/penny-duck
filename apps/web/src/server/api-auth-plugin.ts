import { definePlugin } from "nitro"
import { API_AUTH_HEADER, getApiAuthHeaders } from "./api-auth"

const CLIENT_IP_HEADER = "x-client-ip"

// Cloud Run appends the caller's address to X-Forwarded-For, after anything
// the client sent itself, so only the right-most entry is trustworthy. The API
// trusts X-Client-IP as-is, so a client-sent one is always replaced.
function clientIpFrom(forwardedFor: string | null): string | undefined {
  return forwardedFor?.split(",").at(-1)?.trim() || undefined
}

export function signApiRequest(event: {
  req: Request
}): Promise<void> | undefined {
  if (!new URL(event.req.url).pathname.startsWith("/api/")) return
  const { headers } = event.req
  headers.delete(API_AUTH_HEADER)
  headers.delete(CLIENT_IP_HEADER)
  const clientIp = clientIpFrom(headers.get("x-forwarded-for"))
  if (clientIp) headers.set(CLIENT_IP_HEADER, clientIp)
  if (!process.env.API_IAM_AUDIENCE) return
  return getApiAuthHeaders().then((authHeaders) => {
    for (const [name, value] of Object.entries(authHeaders)) {
      headers.set(name, value)
    }
  })
}

export default definePlugin((nitroApp) => {
  nitroApp.hooks?.hook("request", signApiRequest)
})
