// Read at runtime rather than baked into the build, so one web image runs
// against any API address.
export function getApiUrl(): string {
  return process.env.API_URL ?? "http://localhost:3030"
}
