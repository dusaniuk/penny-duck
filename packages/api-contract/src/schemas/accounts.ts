import { initContract } from "@ts-rest/core"
import { z } from "zod"
import { MessageSchema } from "./common"

const c = initContract()

export const AccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  currency: z.string(),
  balance: z.number(),
})

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1),
  currency: z.string().length(3),
  balance: z.number().optional(),
})

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.string().min(1).optional(),
})

export type Account = z.infer<typeof AccountSchema>

export const accountContract = c.router({
  list: {
    method: "GET",
    path: "/accounts",
    responses: {
      200: z.array(AccountSchema),
    },
  },
  create: {
    method: "POST",
    path: "/accounts",
    body: CreateAccountSchema,
    responses: {
      201: AccountSchema,
    },
  },
  get: {
    method: "GET",
    path: "/accounts/:id",
    responses: {
      200: AccountSchema,
    },
  },
  update: {
    method: "PATCH",
    path: "/accounts/:id",
    body: UpdateAccountSchema,
    responses: {
      200: AccountSchema,
    },
  },
  delete: {
    method: "DELETE",
    path: "/accounts/:id",
    body: c.noBody(),
    responses: {
      200: MessageSchema,
    },
  },
})
