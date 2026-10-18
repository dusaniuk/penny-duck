import { z } from "zod"

export const SessionSchema = z.object({
  id: z.uuid(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
  lastActiveAt: z.string(),
  current: z.boolean(),
})

export type Session = z.infer<typeof SessionSchema>
