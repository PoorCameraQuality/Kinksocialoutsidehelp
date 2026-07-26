/**
 * Static mirror of the Erobay “Community” BDSM events calendar (SF Bay Area).
 *
 * Live source (open in a normal browser; automated fetch is blocked by Cloudflare):
 * https://www.erobay.com/calendar/Calcium40.pl?Op=ShowIt&CalendarName=Community
 *
 * Several titles below match publicly indexed descriptions of this calendar; other
 * rows are typical community listings used to exercise our UI until you replace them
 * with a fresh copy-paste from the site.
 */

import type { MockEvent } from '@/data/types'
import type { ScheduleSlot } from '@/components/conventions/convention-schedule-types'
import { slotsGroupedByDay } from '@/components/conventions/convention-schedule-utils'

/** Canonical list view (same calendar, easier to deep-link). */
export const EROBAY_COMMUNITY_SOURCE_LIST =
  'https://www.erobay.com/calendar/Calcium40.pl?CalendarName=Community&Type=List&Op=ShowIt&NavType=Relative'

const LINK = EROBAY_COMMUNITY_SOURCE_LIST

const DISPLAY_TZ = 'America/Los_Angeles'

/** IANA zone used for every wall-clock label on the mirror page. */
export const EROBAY_DISPLAY_TIMEZONE = DISPLAY_TZ

const erobayCommunityScheduleSlots: ScheduleSlot[] = [
  {
    id: 'erobay-mirror-001',
    startsAt: '2026-04-11T20:00:00-07:00',
    endsAt: '2026-04-11T23:00:00-07:00',
    title: 'Feral: Puppy Love. Pet play party with speed dating [Oakland]',
    description:
      'Monthly pet play party (second Saturday). Activities often include mats, toys, and aerial/suspension areas depending on venue. Confirm details on the source calendar.',
    location: 'Oakland (see organizer listing)',
    linkUrl: LINK,
    trackLabel: 'Play party',
    presenters: [],
  },
  {
    id: 'erobay-mirror-002',
    startsAt: '2026-04-12T11:00:00-07:00',
    endsAt: '2026-04-12T16:00:00-07:00',
    title: 'Filthy Quartz · XXXplicit Kinky Queer Market',
    description: 'Vendor-focused queer kinky market. Check the Erobay listing for vendor roster, accessibility notes, and door policy.',
    location: 'Bay Area venue (see listing)',
    linkUrl: LINK,
    trackLabel: 'Market',
    presenters: [],
  },
  {
    id: 'erobay-mirror-003',
    startsAt: '2026-04-18T21:00:00-07:00',
    endsAt: '2026-04-19T01:00:00-07:00',
    title: 'P³ · Paradox Play Party',
    description: 'Paradox-hosted play party. Arrive in time for orientation; dress code and RSVP rules are on the upstream calendar.',
    location: 'San Francisco · Paradox',
    linkUrl: LINK,
    trackLabel: 'Play party',
    presenters: [],
  },
  {
    id: 'erobay-mirror-004',
    startsAt: '2026-04-16T19:00:00-07:00',
    endsAt: '2026-04-16T21:00:00-07:00',
    title: 'Society of Janus. Newcomers / orientation style social',
    description: 'Community onboarding-style event series common on this calendar. Replace description with text from the live row when you sync.',
    location: 'San Francisco · Janus / partner venue',
    linkUrl: LINK,
    trackLabel: 'Social',
    presenters: [],
  },
  {
    id: 'erobay-mirror-005',
    startsAt: '2026-04-19T18:30:00-07:00',
    endsAt: '2026-04-19T20:30:00-07:00',
    title: 'Wicked Grounds. Rope fundamentals lab',
    description: 'Hands-on rope skills class. Verify level prerequisites and ticketing on the source site.',
    location: 'San Francisco · Wicked Grounds',
    linkUrl: LINK,
    trackLabel: 'Class',
    presenters: [],
  },
  {
    id: 'erobay-mirror-006',
    startsAt: '2026-04-22T18:30:00-07:00',
    endsAt: '2026-04-22T20:00:00-07:00',
    title: 'East Bay munch. Casual restaurant meet',
    description: 'Low-pressure public meetup. Exact restaurant rotates; confirm on Erobay before you travel.',
    location: 'East Bay (restaurant TBD on listing)',
    linkUrl: LINK,
    trackLabel: 'Munch',
    presenters: [],
  },
  {
    id: 'erobay-mirror-007',
    startsAt: '2026-04-24T19:00:00-07:00',
    endsAt: '2026-04-24T21:30:00-07:00',
    title: 'VoxBody. Rope & movement essentials',
    description: 'Movement-forward rope education common in Bay listings. Check listing for what to wear and what to bring.',
    location: 'Oakland · VoxBody',
    linkUrl: LINK,
    trackLabel: 'Class',
    presenters: [],
  },
  {
    id: 'erobay-mirror-008',
    startsAt: '2026-04-26T15:00:00-07:00',
    endsAt: '2026-04-26T18:00:00-07:00',
    title: 'Stopgap. Low-key community social',
    description: 'Afternoon social / open house style slot. Replace with the exact blurb from the live calendar when syncing.',
    location: 'Bay Area (see listing)',
    linkUrl: LINK,
    trackLabel: 'Social',
    presenters: [],
  },
  {
    id: 'erobay-mirror-009',
    startsAt: '2026-04-26T21:00:00-07:00',
    endsAt: '2026-04-27T01:00:00-07:00',
    title: 'BlackThorn. Evening play party',
    description: 'Venue-forward party listing typical of the community feed. Confirm membership, dress code, and covid/health policies on source.',
    location: 'Bay Area · BlackThorn',
    linkUrl: LINK,
    trackLabel: 'Play party',
    presenters: [],
  },
  {
    id: 'erobay-mirror-010',
    startsAt: '2026-05-03T14:00:00-07:00',
    endsAt: '2026-05-03T17:00:00-07:00',
    title: 'Society of Janus. Discussion / education block',
    description: 'Afternoon discussion or workshop-style block. Swap title and abstract from the live row when you refresh this mirror.',
    location: 'San Francisco · Janus',
    linkUrl: LINK,
    trackLabel: 'Class',
    presenters: [],
  },
  {
    id: 'erobay-mirror-011',
    startsAt: '2026-05-09T19:00:00-07:00',
    endsAt: '2026-05-10T00:00:00-07:00',
    title: 'Weekend play party. Multi-DJ / multi-room (placeholder title)',
    description: 'Representative late-night weekend slot. Rename to match the exact Erobay row when you paste an update.',
    location: 'SF / East Bay (see listing)',
    linkUrl: LINK,
    trackLabel: 'Play party',
    presenters: [],
  },
  {
    id: 'erobay-mirror-012',
    startsAt: '2026-05-14T19:00:00-07:00',
    endsAt: '2026-05-14T20:30:00-07:00',
    title: 'Recovery-aligned support circle (community meeting)',
    description: 'Meeting-style calendar entry often appears alongside social events. Verify group name and anonymity rules on the source calendar.',
    location: 'Bay Area (see listing)',
    linkUrl: LINK,
    trackLabel: 'Meeting',
    presenters: [],
  },
  {
    id: 'erobay-mirror-013',
    startsAt: '2026-06-13T12:00:00-07:00',
    endsAt: '2026-06-13T18:00:00-07:00',
    title: 'Outdoor / daytime community fair (placeholder)',
    description: 'Daytime festival or tabling event placeholder for summer months. Replace with Pride-season or picnic rows from Erobay.',
    location: 'Bay Area (see listing)',
    linkUrl: LINK,
    trackLabel: 'Social',
    presenters: [],
  },
]

/** Wall clock string in Pacific, matching `GroupEventCalendar` date strings. */
export function erobayMirrorSlotDateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: EROBAY_DISPLAY_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const parts = f.formatToParts(d)
  const pick = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? ''
  const wd = pick('weekday')
  const mo = pick('month')
  const day = pick('day')
  const hour = pick('hour')
  const min = pick('minute')
  const ap = pick('dayPeriod').toUpperCase()
  return `${wd}, ${mo} ${day} at ${hour}:${min} ${ap}`
}

/** Rows for the group-style month grid (`GroupEventCalendar`). */
export function erobayMirrorSlotsAsMockEvents(slots: readonly ScheduleSlot[]): MockEvent[] {
  return slots.map((s) => ({
    id: s.id,
    title: s.title,
    date: erobayMirrorSlotDateLabel(s.startsAt),
    location: s.location ?? '',
    rsvpCount: 0,
    hostVerified: false,
    description: s.description ?? undefined,
    category: s.trackLabel ?? undefined,
    startsAt: s.startsAt,
  }))
}

export const erobayCommunityCalendarEvents: MockEvent[] = erobayMirrorSlotsAsMockEvents(erobayCommunityScheduleSlots)

/** Canonical slot rows (edit this array when refreshing the mirror). */
export const erobayCommunityMirrorSlots: ScheduleSlot[] = erobayCommunityScheduleSlots

/** Distinct `trackLabel` values for filter chips. */
export function erobayMirrorTrackLabels(slots: readonly ScheduleSlot[]): string[] {
  const set = new Set<string>()
  for (const s of slots) {
    const t = s.trackLabel?.trim()
    if (t) set.add(t)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

/** Calendar day parts in `EROBAY_DISPLAY_TIMEZONE` for month-grid sync / scroll targets. */
export function pacificWallDateFromIso(iso: string): { year: number; monthIndex: number; day: number } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EROBAY_DISPLAY_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d)
  const pick = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value
  const y = pick('year')
  const m = pick('month')
  const day = pick('day')
  if (!y || !m || !day) return null
  return { year: parseInt(y, 10), monthIndex: parseInt(m, 10) - 1, day: parseInt(day, 10) }
}

/** Grouped days for `ConventionScheduleAgenda`. */
export function erobayCommunitySlotsByDay(
  slots: readonly ScheduleSlot[] = erobayCommunityMirrorSlots,
): { day: string; items: ScheduleSlot[] }[] {
  return slotsGroupedByDay([...slots], EROBAY_DISPLAY_TIMEZONE)
}
