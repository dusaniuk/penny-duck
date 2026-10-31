import { defineHandler, proxyRequest } from "nitro/h3"
import { getApiUrl } from "./api-url"

// The API serves routes without the /api prefix.
export function proxyTarget(requestUrl: string): string {
  const { pathname, search } = new URL(requestUrl)
  return `${getApiUrl()}${pathname.slice("/api".length)}${search}`
}

export default defineHandler((event) =>
  proxyRequest(event, proxyTarget(event.req.url))
)
