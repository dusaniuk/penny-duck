import { randomBytes } from "node:crypto"
import * as bcrypt from "bcrypt"
import type { AccessTokenPayload } from "./jwt"

export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS"
  constructor(message = "Invalid email or password") {
    super(message)
    this.name = "InvalidCredentialsError"
  }
}

export class InvalidRefreshTokenError extends Error {
  readonly code = "INVALID_REFRESH_TOKEN"
  constructor(message = "Invalid token") {
    super(message)
    this.name = "InvalidRefreshTokenError"
  }
}

export class WeakPasswordError extends Error {
  readonly code = "WEAK_PASSWORD"
  constructor(message: string) {
    super(message)
    this.name = "WeakPasswordError"
  }
}

export class NotOrgOwnerError extends Error {
  readonly code = "NOT_ORG_OWNER"
  constructor(
    message = "Only the organization owner can generate invite links"
  ) {
    super(message)
    this.name = "NotOrgOwnerError"
  }
}

export type LoginResult = {
  user: { id: string; email: string; name: string }
  accessToken: AccessTokenPayload
  refreshToken: string
}

export type RotateRefreshTokenResult = {
  accessToken: AccessTokenPayload
  refreshToken: string
}

export type SignupResult = {
  userId: string
  email: string
  organizationId: string
}

const REFRESH_TOKEN_BYTES = 48
const REFRESH_TOKEN_LIFETIME_DAYS = 7
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128
const BCRYPT_COST = 12

function newRefreshToken(): { token: string; expiresAt: Date } {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url")
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_LIFETIME_DAYS)
  return { token, expiresAt }
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export async function login(
  email: string,
  password: string,
  deps: {
    findUserByEmail: (
      email: string
    ) => Promise<{
      id: string
      email: string
      name: string
      passwordHash: string
    } | null>
    findOrgByUserId: (userId: string) => Promise<{ id: string } | null>
    insertRefreshToken: (data: {
      userId: string
      token: string
      expiresAt: Date
    }) => Promise<void>
  }
): Promise<LoginResult> {
  const user = await deps.findUserByEmail(normalizeEmail(email))
  if (!user) throw new InvalidCredentialsError()

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new InvalidCredentialsError()

  const org = await deps.findOrgByUserId(user.id)
  if (!org) throw new InvalidCredentialsError()

  const { token, expiresAt } = newRefreshToken()
  await deps.insertRefreshToken({ userId: user.id, token, expiresAt })

  return {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken: { sub: user.id, email: user.email, organizationId: org.id },
    refreshToken: token,
  }
}

export async function rotateRefreshToken(
  rawRefreshToken: string,
  deps: {
    findRefreshToken: (
      token: string
    ) => Promise<{ userId: string; expiresAt: Date } | null>
    deleteRefreshToken: (token: string) => Promise<void>
    insertRefreshToken: (data: {
      userId: string
      token: string
      expiresAt: Date
    }) => Promise<void>
    findUserById: (id: string) => Promise<{ email: string } | null>
    findOrgByUserId: (userId: string) => Promise<{ id: string } | null>
  }
): Promise<RotateRefreshTokenResult> {
  const existing = await deps.findRefreshToken(rawRefreshToken)
  if (!existing || existing.expiresAt < new Date()) {
    throw new InvalidRefreshTokenError()
  }

  await deps.deleteRefreshToken(rawRefreshToken)

  const { token, expiresAt } = newRefreshToken()
  await deps.insertRefreshToken({
    userId: existing.userId,
    token,
    expiresAt,
  })

  const user = await deps.findUserById(existing.userId)
  if (!user) throw new InvalidRefreshTokenError()

  const org = await deps.findOrgByUserId(existing.userId)
  if (!org) throw new InvalidRefreshTokenError()

  return {
    accessToken: {
      sub: existing.userId,
      email: user.email,
      organizationId: org.id,
    },
    refreshToken: token,
  }
}

export async function logout(
  rawRefreshToken: string,
  deps: { deleteRefreshToken: (token: string) => Promise<void> }
): Promise<void> {
  await deps.deleteRefreshToken(rawRefreshToken)
}

export async function signup(
  input: {
    name: string
    email: string
    password: string
    inviteCode?: string
  },
  deps: {
    findUserByEmail: (email: string) => Promise<{ id: string } | null>
    findOrgByInviteCode: (code: string) => Promise<{ id: string } | null>
    insertUser: (data: {
      email: string
      name: string
      passwordHash: string
      agreedToTermsAt: Date
    }) => Promise<{ id: string; email: string; name: string }>
    addOrgMember: (orgId: string, userId: string) => Promise<void>
    createOrgWithOwner: (
      name: string,
      userId: string
    ) => Promise<{ id: string }>
  }
): Promise<SignupResult | null> {
  const normalizedEmail = normalizeEmail(input.email)

  const existing = await deps.findUserByEmail(normalizedEmail)
  if (existing) return null

  let targetOrg: { id: string } | null = null
  if (input.inviteCode) {
    targetOrg = await deps.findOrgByInviteCode(input.inviteCode)
    if (!targetOrg) return null
  }

  if (input.password.length < PASSWORD_MIN_LENGTH) {
    throw new WeakPasswordError(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    )
  }
  if (input.password.length > PASSWORD_MAX_LENGTH) {
    throw new WeakPasswordError(
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
    )
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST)
  const user = await deps.insertUser({
    email: normalizedEmail,
    name: input.name,
    passwordHash,
    agreedToTermsAt: new Date(),
  })

  let organizationId: string
  if (targetOrg) {
    await deps.addOrgMember(targetOrg.id, user.id)
    organizationId = targetOrg.id
  } else {
    const org = await deps.createOrgWithOwner(`${user.name}'s Space`, user.id)
    organizationId = org.id
  }

  return { userId: user.id, email: user.email, organizationId }
}

export async function getInvite(
  code: string,
  deps: {
    findOrgByInviteCode: (code: string) => Promise<{ name: string } | null>
  }
): Promise<{ organizationName: string } | null> {
  const org = await deps.findOrgByInviteCode(code)
  if (!org) return null
  return { organizationName: org.name }
}

export async function generateInviteCode(
  userId: string,
  organizationId: string,
  deps: {
    getMemberRole: (
      orgId: string,
      userId: string
    ) => Promise<string | null>
    setInviteCode: (orgId: string) => Promise<string>
  }
): Promise<string> {
  const role = await deps.getMemberRole(organizationId, userId)
  if (role !== "owner") {
    throw new NotOrgOwnerError()
  }
  return deps.setInviteCode(organizationId)
}
