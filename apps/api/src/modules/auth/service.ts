import { eq, lt, and } from "drizzle-orm"
import { createHash, randomBytes } from "node:crypto"
import { HTTPException } from "hono/http-exception"
import {
  organizationMembers,
  organizations,
  refreshTokens,
  users,
} from "@workspace/db"
import { env } from "@workspace/env/api"
import { db } from "@/db"
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  NotOrgOwnerError,
  WeakPasswordError,
  generateInviteCode,
  getInvite,
  login,
  logout,
  rotateRefreshToken,
  signup,
} from "./core/auth"

export interface SignupInput {
  name: string
  email: string
  password: string
  inviteCode?: string
}

// Refresh tokens are stored as a SHA-256 digest, never in plaintext: the raw
// token lives only in the client's httpOnly cookie. A DB read (leaked backup,
// compromised DATABASE_URL) therefore cannot be replayed to mint sessions.
function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url")
}

export async function signupService(
  input: SignupInput,
): Promise<{ message: string }> {
  try {
    await signup(input, {
      findUserByEmail: async (email) => {
        const rows = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
        return rows[0] ?? null
      },
      findOrgByInviteCode: async (code) => {
        const rows = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.inviteCode, code))
          .limit(1)
        return rows[0] ?? null
      },
      insertUser: async (data) => {
        const [row] = await db.insert(users).values(data).returning({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        return row
      },
      addOrgMember: async (orgId, userId) => {
        await db.insert(organizationMembers).values({
          organizationId: orgId,
          userId,
          role: "member",
        })
      },
      createOrgWithOwner: async (name, userId) => {
        return db.transaction(async (tx) => {
          const [org] = await tx
            .insert(organizations)
            .values({ name })
            .returning({ id: organizations.id })
          await tx.insert(organizationMembers).values({
            organizationId: org.id,
            userId,
            role: "owner",
          })
          return org
        })
      },
    })

    return { message: "Account created successfully" }
  } catch (err) {
    if (err instanceof WeakPasswordError) {
      throw new HTTPException(400, { message: err.message })
    }
    throw err
  }
}

export async function loginService(email: string, password: string) {
  try {
    return await login(email, password, {
      findUserByEmail: async (e) => {
        const rows = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            passwordHash: users.passwordHash,
          })
          .from(users)
          .where(eq(users.email, e))
          .limit(1)
        return rows[0] ?? null
      },
      findOrgByUserId: async (userId) => {
        const rows = await db
          .select({ id: organizations.id })
          .from(organizationMembers)
          .innerJoin(
            organizations,
            eq(organizations.id, organizationMembers.organizationId),
          )
          .where(eq(organizationMembers.userId, userId))
          .limit(1)
        return rows[0] ?? null
      },
      insertRefreshToken: async (data) => {
        await db
          .insert(refreshTokens)
          .values({ ...data, token: hashRefreshToken(data.token) })
      },
    })
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      throw new HTTPException(401, { message: err.message })
    }
    throw err
  }
}

export async function refreshService(rawToken: string) {
  try {
    const result = await rotateRefreshToken(rawToken, {
      findRefreshToken: async (token) => {
        const rows = await db
          .select({
            userId: refreshTokens.userId,
            expiresAt: refreshTokens.expiresAt,
          })
          .from(refreshTokens)
          .where(eq(refreshTokens.token, hashRefreshToken(token)))
          .limit(1)
        return rows[0] ?? null
      },
      deleteRefreshToken: async (token) => {
        await db
          .delete(refreshTokens)
          .where(eq(refreshTokens.token, hashRefreshToken(token)))
      },
      insertRefreshToken: async (data) => {
        await db
          .insert(refreshTokens)
          .values({ ...data, token: hashRefreshToken(data.token) })
      },
      findUserById: async (id) => {
        const rows = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, id))
          .limit(1)
        return rows[0] ?? null
      },
      findOrgByUserId: async (userId) => {
        const rows = await db
          .select({ id: organizations.id })
          .from(organizationMembers)
          .innerJoin(
            organizations,
            eq(organizations.id, organizationMembers.organizationId),
          )
          .where(eq(organizationMembers.userId, userId))
          .limit(1)
        return rows[0] ?? null
      },
    })

    // Lazy cleanup: piggyback on a successful refresh to drop expired rows.
    db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .catch(() => {})

    return result
  } catch (err) {
    if (err instanceof InvalidRefreshTokenError) {
      throw new HTTPException(401, { message: err.message })
    }
    throw err
  }
}

export async function logoutService(rawToken: string): Promise<void> {
  await logout(rawToken, {
    deleteRefreshToken: async (token) => {
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.token, hashRefreshToken(token)))
    },
  })
}

export async function getInviteService(
  code: string,
): Promise<{ organizationName: string } | null> {
  return getInvite(code, {
    findOrgByInviteCode: async (c) => {
      const rows = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.inviteCode, c))
        .limit(1)
      return rows[0] ?? null
    },
  })
}

export async function generateInviteCodeService(
  userId: string,
  organizationId: string,
): Promise<{ inviteCode: string; inviteUrl: string }> {
  try {
    const inviteCode = await generateInviteCode(userId, organizationId, {
      getMemberRole: async (orgId, uid) => {
        const rows = await db
          .select({ role: organizationMembers.role })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, orgId),
              eq(organizationMembers.userId, uid),
            ),
          )
          .limit(1)
        return rows[0]?.role ?? null
      },
      setInviteCode: async (orgId) => {
        const rows = await db
          .select({ inviteCode: organizations.inviteCode })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1)
        if (rows[0]?.inviteCode) return rows[0].inviteCode
        const code = randomBytes(16).toString("base64url")
        await db
          .update(organizations)
          .set({ inviteCode: code })
          .where(eq(organizations.id, orgId))
        return code
      },
    })
    const inviteUrl = `${env.WEB_URL}/invite?code=${inviteCode}`
    return { inviteCode, inviteUrl }
  } catch (err) {
    if (err instanceof NotOrgOwnerError) {
      throw new HTTPException(403, { message: err.message })
    }
    throw err
  }
}
