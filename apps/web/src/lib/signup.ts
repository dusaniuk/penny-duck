import { createServerFn } from "@tanstack/react-start"

export const getSignupOpen = createServerFn().handler(
  (): boolean => process.env.RAILWAY_ENVIRONMENT_NAME !== "production"
)
