const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Invalid email or password",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with this email already exists",
  INVALID_INVITE: "This invite link is invalid or has expired",
  NAME_REQUIRED: "Name is required",
  NAME_TOO_LONG: "Name must be at most 100 characters",
  PROVIDER_NOT_FOUND: "Google sign-in isn't configured",
}

export function authErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
  fallback: string
): string {
  if (!error) return fallback
  return (error.code && MESSAGES[error.code]) || error.message || fallback
}
