/**
 * Cross–play-space personal schedule for Dancecard product surface.
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { buildProgramIcsCalendar, type ProgramIcsEventRow } from './ics-event.js'
import { loadPlayDancecardCalendar, type PlayCalendarItem } from './play-space-dancecard-calendar.js'

export type MyScheduleItem = PlayCalendarItem & {
  playSpaceId: string
  playSpaceSlug: string
  playSpaceTitle: string
  timezone: string
}

export async function loadMyPlaySpaceSchedule(userId: string): Promise<{
  items: MyScheduleItem[]
  spaces: Array<{ id: string; slug: string; title: string; timezone: string }>
}> {
  const memberships = await db
    .select({
      playSpaceId: schema.playSpaceMembers.playSpaceId,
      slug: schema.playSpaces.slug,
      title: schema.playSpaces.title,
      timezone: schema.playSpaces.timezone,
    })
    .from(schema.playSpaceMembers)
    .innerJoin(schema.playSpaces, eq(schema.playSpaceMembers.playSpaceId, schema.playSpaces.id))
    .where(eq(schema.playSpaceMembers.userId, userId))

  if (memberships.length === 0) {
    return { items: [], spaces: [] }
  }

  const spaces = memberships.map((m) => ({
    id: m.playSpaceId,
    slug: m.slug,
    title: m.title,
    timezone: m.timezone,
  }))

  const byId = new Map(spaces.map((s) => [s.id, s]))
  const items: MyScheduleItem[] = []

  await Promise.all(
    spaces.map(async (space) => {
      const { items: cal } = await loadPlayDancecardCalendar(space.id, userId)
      for (const it of cal) {
        items.push({
          ...it,
          playSpaceId: space.id,
          playSpaceSlug: space.slug,
          playSpaceTitle: space.title,
          timezone: space.timezone,
        })
      }
    }),
  )

  items.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  return { items, spaces: [...byId.values()].sort((a, b) => a.title.localeCompare(b.title)) }
}

export function filterScheduleItems(
  items: MyScheduleItem[],
  opts: { range?: 'upcoming' | 'past' | 'all'; spaceSlug?: string },
): MyScheduleItem[] {
  const now = Date.now()
  return items.filter((it) => {
    if (opts.spaceSlug && it.playSpaceSlug !== opts.spaceSlug) return false
    const end = Date.parse(it.endsAt)
    if (opts.range === 'upcoming') return Number.isFinite(end) && end >= now
    if (opts.range === 'past') return Number.isFinite(end) && end < now
    return true
  })
}

export function myScheduleToIcs(
  items: MyScheduleItem[],
  opts: { siteOrigin: string },
): string {
  const events: ProgramIcsEventRow[] = items.map((it) => ({
    uid: `${it.id}@dancecard.kink.social`,
    title: it.title,
    description: [it.subtitle, `Play space: ${it.playSpaceTitle}`, `Kind: ${it.kind.replace(/^dancecard_/, '')}`]
      .filter(Boolean)
      .join('\n'),
    startsAt: new Date(it.startsAt),
    endsAt: new Date(it.endsAt),
    location: it.location ?? it.playSpaceTitle,
    url: `${opts.siteOrigin.replace(/\/$/, '')}/play/${encodeURIComponent(it.playSpaceSlug)}`,
  }))
  return buildProgramIcsCalendar(events, '-//Kink Social//Dancecard Schedule//EN')
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function myScheduleToCsv(items: MyScheduleItem[], siteOrigin: string): string {
  const header = [
    'startsAt',
    'endsAt',
    'title',
    'kind',
    'location',
    'playSpace',
    'playSpaceSlug',
    'notes',
    'url',
  ]
  const rows = items.map((it) =>
    [
      it.startsAt,
      it.endsAt,
      it.title,
      it.kind.replace(/^dancecard_/, ''),
      it.location ?? '',
      it.playSpaceTitle,
      it.playSpaceSlug,
      it.subtitle ?? '',
      `${siteOrigin.replace(/\/$/, '')}/play/${encodeURIComponent(it.playSpaceSlug)}`,
    ]
      .map((c) => csvEscape(String(c)))
      .join(','),
  )
  return [header.join(','), ...rows].join('\r\n') + '\r\n'
}
