import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { isPlatformModeratorUser, isSiteAdmin, isTrustSafetyAdmin } from './platform-staff.js'
import { isUserIdentityBanned } from './peer-reputation.js'

export function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
    reply.status(503).send({ error: 'Set USE_DATABASE=true' })
    return false
  }
  return true
}

/** UUID-only authenticated user for moderation and privacy-sensitive routes. */
export function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  return requireAuthenticatedDbUser(req, reply)
}

/** Reject banned users on mutating/authenticated routes (async follow-up to requireUser). */
export async function rejectIfUserIdentityBanned(
  userId: string,
  reply: FastifyReply,
): Promise<boolean> {
  if (process.env.USE_DATABASE !== 'true') return false
  if (await isUserIdentityBanned(userId)) {
    reply.status(403).send({ error: 'Access denied' })
    return true
  }
  return false
}

export async function requirePlatformModerator(userId: string, reply: FastifyReply): Promise<boolean> {
  if (!(await isPlatformModeratorUser(userId))) {
    reply.status(403).send({ error: 'Forbidden' })
    return false
  }
  return true
}

export async function requireSiteAdmin(userId: string, reply: FastifyReply): Promise<boolean> {
  if (!(await isSiteAdmin(userId))) {
    reply.status(403).send({ error: 'Forbidden' })
    return false
  }
  return true
}

export async function requireSiteOwner(userId: string, reply: FastifyReply): Promise<boolean> {
  const { isSiteOwner } = await import('./platform-staff.js')
  if (!(await isSiteOwner(userId))) {
    reply.status(403).send({ error: 'Forbidden. Owner access required' })
    return false
  }
  return true
}

/** Destructive enforcement (delete/suspend) — not general triage moderators. */
export async function requireTrustSafetyAdmin(userId: string, reply: FastifyReply): Promise<boolean> {
  if (!(await isTrustSafetyAdmin(userId))) {
    reply.status(403).send({ error: 'Forbidden. Trust & safety admin access required' })
    return false
  }
  return true
}

/**
 * Case actions that require trust-safety (or higher) — not general triage moderators.
 * Used by T&S case action routes before `executeModerationCaseAction`.
 */
export const DESTRUCTIVE_MODERATION_CASE_ACTIONS = new Set(['delete_content', 'suspend_subject'])
