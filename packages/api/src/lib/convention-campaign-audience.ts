import { and, eq, inArray, isNotNull, ne } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getUserEmailById } from './user-email.js'

export type CampaignAudienceMode = 'going' | 'interested' | 'going_and_interested'

export type CampaignRecipient = {
  registrantId: string | null
  email: string
  displayName: string | null
  userId: string | null
  source: 'registrant' | 'rsvp_going' | 'rsvp_interested'
}

export function parseCampaignAudienceMode(filter: unknown): CampaignAudienceMode {
  if (!filter || typeof filter !== 'object') return 'going_and_interested'
  const rec = filter as Record<string, unknown>
  const mode = typeof rec.audience === 'string' ? rec.audience : typeof rec.mode === 'string' ? rec.mode : ''
  if (mode === 'going' || mode === 'interested' || mode === 'going_and_interested') return mode
  const statuses = Array.isArray(rec.rsvpStatuses) ? rec.rsvpStatuses.map(String) : []
  const hasGoing = statuses.includes('going')
  const hasMaybe = statuses.includes('maybe') || statuses.includes('interested')
  if (hasGoing && hasMaybe) return 'going_and_interested'
  if (hasGoing) return 'going'
  if (hasMaybe) return 'interested'
  return 'going_and_interested'
}

function wantGoing(mode: CampaignAudienceMode): boolean {
  return mode === 'going' || mode === 'going_and_interested'
}

function wantInterested(mode: CampaignAudienceMode): boolean {
  return mode === 'interested' || mode === 'going_and_interested'
}

async function conventionRelatedEventIds(conv: {
  organizationId: string | null
  anchorEventId: string | null
}): Promise<string[]> {
  const ids = new Set<string>()
  if (conv.anchorEventId) ids.add(conv.anchorEventId)
  if (conv.organizationId) {
    const rows = await db
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(eq(schema.events.organizationId, conv.organizationId))
      .limit(200)
    for (const r of rows) ids.add(r.id)
  }
  return [...ids]
}

export async function resolveConventionCampaignRecipients(input: {
  conventionId: string
  organizationId: string | null
  anchorEventId: string | null
  audience: CampaignAudienceMode
}): Promise<CampaignRecipient[]> {
  const byEmail = new Map<string, CampaignRecipient>()

  if (wantGoing(input.audience)) {
    const regs = await db
      .select({
        id: schema.conventionRegistrants.id,
        email: schema.conventionRegistrants.email,
        displayName: schema.conventionRegistrants.displayName,
        userId: schema.conventionRegistrants.userId,
      })
      .from(schema.conventionRegistrants)
      .where(
        and(
          eq(schema.conventionRegistrants.conventionId, input.conventionId),
          isNotNull(schema.conventionRegistrants.email),
          ne(schema.conventionRegistrants.registrationStatus, 'cancelled'),
        ),
      )
    for (const r of regs) {
      const email = String(r.email ?? '')
        .trim()
        .toLowerCase()
      if (!email.includes('@')) continue
      byEmail.set(email, {
        registrantId: r.id,
        email,
        displayName: r.displayName,
        userId: r.userId,
        source: 'registrant',
      })
    }
  }

  const eventIds = await conventionRelatedEventIds({
    organizationId: input.organizationId,
    anchorEventId: input.anchorEventId,
  })

  if (eventIds.length > 0) {
    const statuses: Array<'going' | 'maybe'> = []
    if (wantGoing(input.audience)) statuses.push('going')
    if (wantInterested(input.audience)) statuses.push('maybe')
    if (statuses.length > 0) {
      const rsvps = await db
        .select({
          userId: schema.eventRsvps.userId,
          status: schema.eventRsvps.status,
          displayName: schema.profiles.displayName,
        })
        .from(schema.eventRsvps)
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.eventRsvps.userId))
        .where(and(inArray(schema.eventRsvps.eventId, eventIds), inArray(schema.eventRsvps.status, statuses)))

      for (const r of rsvps) {
        const email = (await getUserEmailById(r.userId))?.trim().toLowerCase()
        if (!email?.includes('@')) continue
        const source = r.status === 'maybe' ? 'rsvp_interested' : 'rsvp_going'
        if (!byEmail.has(email)) {
          byEmail.set(email, {
            registrantId: null,
            email,
            displayName: r.displayName,
            userId: r.userId,
            source,
          })
        }
      }
    }
  }

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email))
}

export async function countConventionCampaignAudience(input: {
  conventionId: string
  organizationId: string | null
  anchorEventId: string | null
  audience: CampaignAudienceMode
}): Promise<{
  emailReach: number
  inboxReach: number
  goingCount: number
  interestedCount: number
}> {
  const [going, interested, both] = await Promise.all([
    resolveConventionCampaignRecipients({ ...input, audience: 'going' }),
    resolveConventionCampaignRecipients({ ...input, audience: 'interested' }),
    resolveConventionCampaignRecipients({ ...input, audience: input.audience }),
  ])
  const inboxReach = new Set(both.map((r) => r.userId).filter(Boolean)).size
  return {
    emailReach: both.length,
    inboxReach,
    goingCount: going.length,
    interestedCount: interested.length,
  }
}
