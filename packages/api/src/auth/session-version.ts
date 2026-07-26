import type { SessionPayload } from '@c2k/shared/session-token'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export async function sessionPayloadForUser(user: {
  id: string
  username: string
  sessionVersion?: number | null
}): Promise<SessionPayload> {
  return {
    username: user.username,
    sub: user.id,
    sv: user.sessionVersion ?? 0,
  }
}

export async function loadUserSessionVersion(userId: string): Promise<number> {
  const [row] = await db
    .select({ sessionVersion: schema.users.sessionVersion })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  return row?.sessionVersion ?? 0
}

export function sessionVersionMatches(payload: SessionPayload, dbVersion: number): boolean {
  const tokenVersion = payload.sv ?? 0
  return tokenVersion === dbVersion
}

/** Revoke every outstanding session for the user (logout-everywhere semantics). */
export async function incrementUserSessionVersion(userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ sessionVersion: sql`${schema.users.sessionVersion} + 1` })
    .where(eq(schema.users.id, userId))
}
