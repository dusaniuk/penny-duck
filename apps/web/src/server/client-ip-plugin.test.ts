import { describe, expect, it, vi } from "vitest"
import plugin, { setClientIp } from "./client-ip-plugin"

describe("setClientIp", () => {
  it("registers the request hook", () => {
    const hook = vi.fn()
    plugin({ hooks: { hook } } as unknown as Parameters<typeof plugin>[0])
    expect(hook).toHaveBeenCalledWith("request", setClientIp)
  })

  it("replaces x-client-ip with the right-most x-forwarded-for entry", () => {
    const req = new Request("http://web.example/api/auth/sign-in/email", {
      headers: {
        "x-forwarded-for": "6.6.6.6, 203.0.113.7",
        "x-client-ip": "6.6.6.6",
      },
    })

    setClientIp({ req })
    expect(req.headers.get("x-client-ip")).toBe("203.0.113.7")
  })

  it("drops a client-supplied x-client-ip without x-forwarded-for", () => {
    const req = new Request("http://web.example/api/accounts", {
      headers: { "x-client-ip": "6.6.6.6" },
    })

    setClientIp({ req })
    expect(req.headers.has("x-client-ip")).toBe(false)
  })

  it("leaves non-API requests alone", () => {
    const req = new Request("http://web.example/accounts", {
      headers: { "x-client-ip": "6.6.6.6" },
    })

    setClientIp({ req })
    expect(req.headers.get("x-client-ip")).toBe("6.6.6.6")
  })
})
