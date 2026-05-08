import { z } from "zod"
import { ApiErrorSchema } from "@workspace/shared/errors"

export const MessageSchema = z.object({
  message: z.string(),
})

export const ErrorResponseSchema = ApiErrorSchema

export function PaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })
}
