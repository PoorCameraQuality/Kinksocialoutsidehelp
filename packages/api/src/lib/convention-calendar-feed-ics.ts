import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import * as schema from '../db/schema.js'
import { filterSlotsForPublicProgram, publicProgramViewerFromAccess } from './convention-program-policy.js'
import { buildProgramIcsCalendar } from './ics-event.js'
import { hashSecret } from '../routes/convention-organizer/shared.js'

export async function buildConventionCalendarFeedIcs(
  conventionId: string,
  conventionSlug: string,
  conventionName: string,
  rawToken: string,
): Promise<{ ok: true; ics: string } | { ok: false; status: 404 | 410 }> {
  const tokenHash = hashSecret(rawToken.trim())
  const [feed] = await db
    .select()
    .from(schema.conventionCalendarFeedTokens)
    .where(
      and(
        eq(schema.conventionCalendarFeedTokens.conventionId, conventionId),
        eq(schema.conventionCalendarFeedTokens.tokenHash, tokenHash),
      ),
    )
    .limit(1)
  if (!feed) return { ok: false, status: 404 }
  if (feed.revokedAt) return { ok: false, status: 410 }

  const allSlots = await db
    .select()
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conventionId))
    .orderBy(schema.scheduleSlots.startsAt)

  let rows = filterSlotsForPublicProgram(allSlots, publicProgramViewerFromAccess(false, null))

  if (feed.scope === 'track' && feed.filterTrackId) {
    rows = rows.filter((s) => s.trackId === feed.filterTrackId)
  } else if (feed.scope === 'location' && feed.filterLocationId) {
    rows = rows.filter((s) => s.locationId === feed.filterLocationId)
  } else if (feed.scope === 'person' && feed.filterPersonId) {
    const slotIds = rows.map((s) => s.id)
    if (slotIds.length > 0) {
      const pres = await db
        .select({ scheduleSlotId: schema.scheduleSlotPresenters.scheduleSlotId })
        .from(schema.scheduleSlotPresenters)
        .where(
          and(
            inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds),
            eq(schema.scheduleSlotPresenters.userId, feed.filterPersonId),
          ),
        )
      const allowed = new Set(pres.map((p) => p.scheduleSlotId))
      rows = rows.filter((s) => allowed.has(s.id))
    } else {
      rows = []
    }
  }

  const base =
    (process.env.C2K_WEB_PUBLIC_URL ?? process.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '')
  const convUrl = `${base}/conventions/${encodeURIComponent(conventionSlug)}`
  const events = rows.map((s) => ({
    uid: `${s.id}@c2k-feed`,
    title: s.title,
    description: [s.description, s.trackLabel ? `Track: ${s.trackLabel}` : '', s.roomLabel ? `Room: ${s.roomLabel}` : '']
      .filter(Boolean)
      .join('\n'),
    startsAt: new Date(s.startsAt),
    endsAt: new Date(s.endsAt),
    location: s.location,
    url: convUrl,
  }))
  const prodId = `-//C2K//${conventionSlug}//${feed.label ?? feed.scope}`
  return { ok: true, ics: buildProgramIcsCalendar(events, prodId) }
}
