import jwt, { type SignOptions } from "jsonwebtoken"

export type AccessTokenPayload = {
  sub: string
  email: string
  organizationId: string
}

export function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
  expiresIn: string
): string {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions)
}

export function verifyAccessToken(
  token: string,
  secret: string
): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret)
    if (typeof decoded === "string") return null
    const { sub, email, organizationId } = decoded as Record<string, unknown>
    if (
      typeof sub !== "string" ||
      typeof email !== "string" ||
      typeof organizationId !== "string"
    ) {
      return null
    }
    return { sub, email, organizationId }
  } catch {
    return null
  }
}
