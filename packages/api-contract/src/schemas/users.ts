import { initContract } from "@ts-rest/core"
import { z } from "zod"

const c = initContract()

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  homeCurrency: z.string(),
})

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  homeCurrency: z.string().length(3).optional(),
})

export const userContract = c.router({
  getMe: {
    method: "GET",
    path: "/users/me",
    responses: {
      200: UserSchema,
    },
  },
  updateMe: {
    method: "PATCH",
    path: "/users/me",
    body: UpdateProfileSchema,
    responses: {
      200: UserSchema,
    },
  },
})
