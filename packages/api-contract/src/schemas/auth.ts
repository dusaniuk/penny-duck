import { initContract } from "@ts-rest/core"
import { z } from "zod"
import { MessageSchema } from "./common"

const c = initContract()

export const SignupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
})

export const authContract = c.router({
  signup: {
    method: "POST",
    path: "/auth/signup",
    body: SignupSchema,
    responses: {
      201: AuthUserSchema,
    },
  },
  login: {
    method: "POST",
    path: "/auth/login",
    body: LoginSchema,
    responses: {
      200: AuthUserSchema,
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
  me: {
    method: "GET",
    path: "/auth/me",
    responses: {
      200: AuthUserSchema,
    },
  },
})
