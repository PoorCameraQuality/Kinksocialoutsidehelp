import type { FastifyRequest } from 'fastify'

import { and, eq, gt, isNull, or, type SQL } from 'drizzle-orm'

import { db, schema } from '../db/index.js'

import { clientIpLabel } from './client-ip.js'



/**

 * Phase 0: peer ±1 voting is deprecated in favor of trust-context signals.

 * Votes no longer mutate trust_score, create identity_bans, or profile_review_flags.

 */

export async function applyPeerReputationVote(input: {

  req: FastifyRequest

  sourceUserId: string

  targetUserId: string

  delta: 1 | -1

}): Promise<{ weightApplied: number; trustScore: number; deprecated: true }> {

  if (input.sourceUserId === input.targetUserId) {

    throw new Error('self_vote')

  }

  const [prof] = await db

    .select({ trustScore: schema.profiles.trustScore })

    .from(schema.profiles)

    .where(eq(schema.profiles.userId, input.targetUserId))

    .limit(1)

  return {

    weightApplied: 0,

    trustScore: prof?.trustScore ?? 0,

    deprecated: true,

  }

}



async function hasActiveIdentityBan(whereClause: SQL): Promise<boolean> {
  const rows = await db
    .select({ id: schema.identityBans.id })
    .from(schema.identityBans)
    .where(
      and(
        whereClause,
        or(isNull(schema.identityBans.expiresAt), gt(schema.identityBans.expiresAt, new Date())),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/** Active platform identity ban for a signed-in user (survives IP changes). */
export async function isUserIdentityBanned(userId: string): Promise<boolean> {
  if (!userId) return false
  return hasActiveIdentityBan(eq(schema.identityBans.userId, userId))
}

export async function checkIdentityBan(req: FastifyRequest, userId?: string): Promise<boolean> {
  const ip = clientIpLabel(req).slice(0, 64)
  if (
    await hasActiveIdentityBan(eq(schema.identityBans.ipPrefix, ip))
  ) {
    return true
  }
  if (userId && (await isUserIdentityBanned(userId))) {
    return true
  }
  return false
}

