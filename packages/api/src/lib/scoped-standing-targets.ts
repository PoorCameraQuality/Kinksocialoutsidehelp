import type { TrustScopeType } from '@c2k/shared'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { requireConventionCommand } from './convention-command-access.js'
import { viewerCanPatchEvent } from './virtual-event-join-visibility.js'
import { resolveConventionId } from '../routes/conventions-routes.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ScopedStandingTarget = {
  scopeType: TrustScopeType
  scopeId: string
  /** Route key used in URLs (slug or UUID) */
  scopeKey: string
  participation: {
    linked: boolean
    model: 'full' | 'limited' | 'staff_only'
    detail: string | null
  }
}

export async function resolveEventStandingTarget(eventId: string): Promise<ScopedStandingTarget | null> {
  if (!UUID_RE.test(eventId)) return null
  const [event] = await db
    .select({
      id: schema.events.id,
      hostId: schema.events.hostId,
      organizationId: schema.events.organizationId,
      title: schema.events.title,
    })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)
  if (!event) return null
  return {
    scopeType: 'event',
    scopeId: event.id,
    scopeKey: event.id,
    participation: {
      linked: true,
      model: 'limited',
      detail: 'Event participation inferred from RSVP/host records when available.',
    },
  }
}

export async function resolveConventionStandingTarget(key: string): Promise<ScopedStandingTarget | null> {
  const convId = await resolveConventionId(key)
  if (!convId) return null
  const [conv] = await db
    .select({ id: schema.conventions.id, slug: schema.conventions.slug })
    .from(schema.conventions)
    .where(eq(schema.conventions.id, convId))
    .limit(1)
  if (!conv) return null
  return {
    scopeType: 'convention',
    scopeId: conv.id,
    scopeKey: conv.slug ?? conv.id,
    participation: {
      linked: true,
      model: 'limited',
      detail: 'Convention participation inferred from access grants and registrations when available.',
    },
  }
}

export async function userParticipatesInEvent(eventId: string, userId: string): Promise<boolean> {
  const [event] = await db
    .select({ hostId: schema.events.hostId })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)
  if (!event) return false
  if (event.hostId === userId) return true

  const [rsvp] = await db
    .select({ id: schema.eventRsvps.id })
    .from(schema.eventRsvps)
    .where(
      and(
        eq(schema.eventRsvps.eventId, eventId),
        eq(schema.eventRsvps.userId, userId),
        eq(schema.eventRsvps.status, 'going')
      )
    )
    .limit(1)
  return Boolean(rsvp)
}

export async function userParticipatesInConvention(conventionId: string, userId: string): Promise<boolean> {
  const [grant] = await db
    .select({ id: schema.conventionAccessGrants.id })
    .from(schema.conventionAccessGrants)
    .where(
      and(
        eq(schema.conventionAccessGrants.conventionId, conventionId),
        eq(schema.conventionAccessGrants.userId, userId)
      )
    )
    .limit(1)
  if (grant) return true

  const [reg] = await db
    .select({ id: schema.conventionRegistrants.id })
    .from(schema.conventionRegistrants)
    .where(
      and(
        eq(schema.conventionRegistrants.conventionId, conventionId),
        eq(schema.conventionRegistrants.userId, userId)
      )
    )
    .limit(1)
  return Boolean(reg)
}

export async function canModerateEventScope(eventId: string, actorUserId: string): Promise<boolean> {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
  if (!event) return false
  if (event.hostId === actorUserId) return true
  return viewerCanPatchEvent(actorUserId, event)
}

export async function canModerateConventionScope(
  key: string,
  actorUserId: string,
  reply: import('fastify').FastifyReply
): Promise<{ convId: string } | null> {
  const access = await requireConventionCommand(key, actorUserId, reply, 'staff_ops')
  if (!access) return null
  const convId = await resolveConventionId(key)
  if (!convId) return null
  return { convId }
}

export async function getUserScopedRestrictionsForScope(
  userId: string,
  scopeType: TrustScopeType,
  scopeId: string
): Promise<{
  standing: string
  activeBan: boolean
  expiresAt: string | null
  scopeType: TrustScopeType
  scopeId: string
} | null> {
  const { getScopedStandingView } = await import('./scoped-standing.js')
  const view = await getScopedStandingView(userId, scopeType, scopeId)
  if (view.standing === 'GOOD_STANDING' && !view.activeBan) return null
  return {
    standing: view.standing,
    activeBan: view.activeBan,
    expiresAt: view.expiresAt,
    scopeType,
    scopeId,
  }
}
