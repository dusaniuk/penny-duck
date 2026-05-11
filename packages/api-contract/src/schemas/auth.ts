import { z } from "zod"

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
