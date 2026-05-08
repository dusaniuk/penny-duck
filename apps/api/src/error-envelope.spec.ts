import { describe, it, expect, vi } from "vitest"
import { BadRequestException, ArgumentsHost, Logger } from "@nestjs/common"
import { Hono } from "hono"
import { z, ZodError } from "zod"
import { zodErrorResponse } from "@ts-rest/core"
import { AllExceptionsFilter } from "./all-exceptions.filter"
import { attachErrorHandlers } from "./hono/app"

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0),
})

function makeZodIssues(): ZodError {
  const result = schema.safeParse({ email: "not-an-email", age: -1 })
  if (result.success) throw new Error("expected validation failure")
  return result.error
}

function makeNestHost(): { host: ArgumentsHost; getBody: () => unknown; getStatus: () => number } {
  let captured: unknown = undefined
  let statusCode = 0
  const response = {
    status(code: number) {
      statusCode = code
      return this
    },
    json(body: unknown) {
      captured = body
      return this
    },
  }
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost
  return {
    host,
    getBody: () => captured,
    getStatus: () => statusCode,
  }
}

describe("error envelope parity", () => {
  it("NestJS filter and Hono onError emit byte-equivalent JSON for the same Zod error", async () => {
    const zodError = makeZodIssues()

    const filter = new AllExceptionsFilter()
    const tsRestException = new BadRequestException(zodErrorResponse(zodError))
    const nestCtx = makeNestHost()
    filter.catch(tsRestException, nestCtx.host)
    const nestBody = nestCtx.getBody()
    const nestStatus = nestCtx.getStatus()

    const app = attachErrorHandlers(new Hono())
    app.get("/boom", () => {
      throw zodError
    })
    const honoRes = await app.request("/boom")
    const honoBody = await honoRes.json()

    expect(nestStatus).toBe(400)
    expect(honoRes.status).toBe(400)
    expect(JSON.stringify(nestBody)).toBe(JSON.stringify(honoBody))
    expect(nestBody).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
    })
    expect(Array.isArray((nestBody as { details: unknown[] }).details)).toBe(true)
  })

  it("Hono notFound returns the standard envelope", async () => {
    const app = attachErrorHandlers(new Hono())
    const res = await app.request("/missing")
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Not found",
    })
  })

  it("NestJS filter wraps a string-bodied HttpException", () => {
    const filter = new AllExceptionsFilter()
    const exception = new BadRequestException("Email already taken")
    const ctx = makeNestHost()
    filter.catch(exception, ctx.host)
    expect(ctx.getStatus()).toBe(400)
    expect(ctx.getBody()).toEqual({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Email already taken",
    })
  })

  it("NestJS filter masks unknown errors as INTERNAL_ERROR", () => {
    const filter = new AllExceptionsFilter()
    const ctx = makeNestHost()
    const logSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
    filter.catch(new Error("oops"), ctx.host)
    logSpy.mockRestore()
    expect(ctx.getStatus()).toBe(500)
    expect(ctx.getBody()).toEqual({
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    })
  })
})
