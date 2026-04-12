import { initContract } from "@ts-rest/core"
import { z } from "zod"
import { MessageSchema } from "./common"
import { UserSchema } from "./users"

const c = initContract()

export const SignupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  inviteCode: z.string().optional(),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const InviteInfoSchema = z.object({
  organizationName: z.string(),
})

export const InviteCodeSchema = z.object({
  inviteCode: z.string(),
  inviteUrl: z.string(),
})

export const authContract = c.router({
  signup: {
    method: "POST",
    path: "/auth/signup",
    body: SignupSchema,
    responses: {
      201: MessageSchema,
    },
  },
  login: {
    method: "POST",
    path: "/auth/login",
    body: LoginSchema,
    responses: {
      200: UserSchema,
    },
  },
  refresh: {
    method: "POST",
    path: "/auth/refresh",
    body: c.noBody(),
    responses: {
      200: MessageSchema,
    },
  },
  logout: {
    method: "POST",
    path: "/auth/logout",
    body: c.noBody(),
    responses: {
      200: MessageSchema,
    },
  },
  getInvite: {
    method: "GET",
    path: "/auth/invite",
    query: z.object({
      code: z.string(),
    }),
    responses: {
      200: InviteInfoSchema,
      404: MessageSchema,
    },
  },
  generateInviteCode: {
    method: "POST",
    path: "/auth/invite-code",
    body: c.noBody(),
    responses: {
      200: InviteCodeSchema,
      403: MessageSchema,
    },
  },
})
