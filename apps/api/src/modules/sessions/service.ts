import { and, desc, eq, gt, ne } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import type { Session } from "@workspace/api-contract"
import { sessions } from "@workspace/db"
import { db } from "@/db"

export async function listSessions(
  userId: string,
  currentSessionId: string
): Promise<Session[]> {
  const rows = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.updatedAt))

  return rows
    .map((r) => ({
      id: r.id,
      userAgent: r.userAgent,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
      lastActiveAt: r.updatedAt.toISOString(),
      current: r.id === currentSessionId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current))
}

export async function revokeSession(
  userId: string,
  currentSessionId: string,
  sessionId: string
): Promise<void> {
  if (sessionId === currentSessionId) {
    throw new HTTPException(400, {
      message: "Sign out to end the current session",
    })
  }
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id })
  if (deleted.length === 0) {
    throw new HTTPException(404, { message: "Session not found" })
  }
}

export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string
): Promise<{ revoked: number }> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
    .returning({ id: sessions.id })
  return { revoked: deleted.length }
}
