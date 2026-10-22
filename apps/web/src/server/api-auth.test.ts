import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const AUDIENCE = "https://api.example"

function jwt(expSeconds: number) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${encode({ alg: "none" })}.${encode({ exp: expSeconds })}.sig`
}

async function load() {
  vi.resetModules()
  return import("./api-auth")
}

describe("getApiAuthHeaders", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"))
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("API_IAM_AUDIENCE", AUDIENCE)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  const expIn = (ms: number) => Math.floor((Date.now() + ms) / 1000)

  it("returns no headers when API_IAM_AUDIENCE is unset", async () => {
    vi.stubEnv("API_IAM_AUDIENCE", "")
    const { getApiAuthHeaders } = await load()
    expect(await getApiAuthHeaders()).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fetches a token from the metadata server with the audience", async () => {
    const token = jwt(expIn(60 * 60 * 1000))
    fetchMock.mockResolvedValueOnce(new Response(token))
    const { getApiAuthHeaders } = await load()

    expect(await getApiAuthHeaders()).toEqual({
      "x-serverless-authorization": `Bearer ${token}`,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toMatch(/audience=https%3A%2F%2Fapi\.example$/)
    expect(new Headers(init?.headers).get("Metadata-Flavor")).toBe("Google")
  })

  it("reuses the cached token until 5 minutes before exp", async () => {
    const hour = 60 * 60 * 1000
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(jwt(expIn(hour))))
    )
    const { getApiAuthHeaders } = await load()

    await getApiAuthHeaders()
    await getApiAuthHeaders()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(hour - 4 * 60 * 1000)
    await getApiAuthHeaders()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("shares one in-flight fetch between concurrent callers", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(jwt(expIn(60 * 60 * 1000))))
    )
    const { getApiAuthHeaders } = await load()

    await Promise.all([
      getApiAuthHeaders(),
      getApiAuthHeaders(),
      getApiAuthHeaders(),
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("gives up on a metadata fetch that never answers", async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted"))
          )
        })
    )
    const { getApiAuthHeaders } = await load()

    const call = getApiAuthHeaders()
    const settled = expect(call).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(3000)
    await settled
  })

  it("retries after a failed fetch", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("metadata unreachable"))
      .mockResolvedValueOnce(new Response(jwt(expIn(60 * 60 * 1000))))
    const { getApiAuthHeaders } = await load()

    await expect(getApiAuthHeaders()).rejects.toThrow("metadata unreachable")
    expect(await getApiAuthHeaders()).toHaveProperty(
      "x-serverless-authorization"
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("signApiRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("strips a client-supplied x-serverless-authorization", async () => {
    vi.stubEnv("API_IAM_AUDIENCE", "")
    vi.resetModules()
    const { signApiRequest } = await import("./api-auth-plugin")
    const req = new Request("http://web.example/api/accounts", {
      headers: { "x-serverless-authorization": "Bearer evil" },
    })

    await signApiRequest({ req })
    expect(req.headers.has("x-serverless-authorization")).toBe(false)
  })

  it("registers the request hook even without an IAM audience", async () => {
    vi.stubEnv("API_IAM_AUDIENCE", "")
    vi.resetModules()
    const { default: plugin, signApiRequest } =
      await import("./api-auth-plugin")
    const hook = vi.fn()

    plugin({ hooks: { hook } } as unknown as Parameters<typeof plugin>[0])
    expect(hook).toHaveBeenCalledWith("request", signApiRequest)
  })

  it("replaces x-client-ip with the right-most x-forwarded-for entry", async () => {
    vi.stubEnv("API_IAM_AUDIENCE", "")
    vi.resetModules()
    const { signApiRequest } = await import("./api-auth-plugin")
    const req = new Request("http://web.example/api/auth/sign-in/email", {
      headers: {
        "x-forwarded-for": "6.6.6.6, 203.0.113.7",
        "x-client-ip": "6.6.6.6",
      },
    })

    await signApiRequest({ req })
    expect(req.headers.get("x-client-ip")).toBe("203.0.113.7")
  })

  it("drops a client-supplied x-client-ip without x-forwarded-for", async () => {
    vi.stubEnv("API_IAM_AUDIENCE", "")
    vi.resetModules()
    const { signApiRequest } = await import("./api-auth-plugin")
    const req = new Request("http://web.example/api/accounts", {
      headers: { "x-client-ip": "6.6.6.6" },
    })

    await signApiRequest({ req })
    expect(req.headers.has("x-client-ip")).toBe(false)
  })
})
