import { describe, expect, it } from "vitest"
import { unwrap } from "./api"
import { ApiRequestError } from "./errors"

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("unwrap", () => {
  it("returns the parsed body of a successful response", async () => {
    await expect(
      unwrap(Promise.resolve(json({ id: "a" }, 200)))
    ).resolves.toEqual({ id: "a" })
  })

  it("throws the API error body as an ApiRequestError", async () => {
    const res = json(
      {
        statusCode: 409,
        code: "CONFLICT",
        message: "Name taken",
        details: [{ path: "name", message: "Name taken" }],
      },
      409
    )
    const err = await unwrap(Promise.resolve(res)).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiRequestError)
    expect(err).toMatchObject({
      message: "Name taken",
      statusCode: 409,
      code: "CONFLICT",
      details: [{ path: "name", message: "Name taken" }],
    })
  })

  it("falls back to the status when the error body is not JSON", async () => {
    const res = new Response("<html>Bad Gateway</html>", {
      status: 502,
      statusText: "Bad Gateway",
    })
    const err = await unwrap(Promise.resolve(res)).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiRequestError)
    expect(err).toMatchObject({
      message: "Bad Gateway",
      statusCode: 502,
      code: "BAD_GATEWAY",
    })
  })
})
