// Mutations throw the API's JSON error body (not an Error), so read `message`
// off any object.
export function errorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof err.message === "string"
  ) {
    return err.message
  }
  return fallback
}
