import { z } from "zod"

export const MessageSchema = z.object({
  message: z.string(),
})

export const ErrorResponseSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
})

export function PaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })
}
