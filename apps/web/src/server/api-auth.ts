export const API_AUTH_HEADER = "x-serverless-authorization"

const IDENTITY_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"
const REFRESH_MARGIN_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 3000

let cached: { token: string; expiresAt: number } | null = null
let pending: Promise<string> | null = null

function readExpiry(token: string): number {
  const payload = token.split(".")[1] ?? ""
  const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
    exp?: number
  }
  return (exp ?? 0) * 1000
}

async function fetchToken(audience: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let token: string
  try {
    const res = await fetch(
      `${IDENTITY_URL}?audience=${encodeURIComponent(audience)}`,
      { headers: { "Metadata-Flavor": "Google" }, signal: controller.signal }
    )
    if (!res.ok) throw new Error(`metadata server returned ${res.status}`)
    token = (await res.text()).trim()
  } finally {
    clearTimeout(timer)
  }
  cached = { token, expiresAt: readExpiry(token) }
  return token
}

function getToken(audience: string): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) {
    return Promise.resolve(cached.token)
  }
  pending ??= fetchToken(audience).finally(() => {
    pending = null
  })
  return pending
}

// On Cloud Run the API only accepts callers holding a Google ID token for its
// URL. Cloud Run reads it from X-Serverless-Authorization, leaving
// Authorization to the app.
export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const audience = process.env.API_IAM_AUDIENCE
  if (!audience) return {}
  return { [API_AUTH_HEADER]: `Bearer ${await getToken(audience)}` }
}
