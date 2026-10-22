import { createServerFn } from "@tanstack/react-start"

export const getSignupOpen = createServerFn().handler(
  (): boolean => process.env.NODE_ENV !== "production"
)
