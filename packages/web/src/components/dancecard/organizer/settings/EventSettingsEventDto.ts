import type { AgreementsConfig } from '@/lib/dancecard/agreementsConfig'
import type { AttendeeProfileConfig } from '@/lib/dancecard/attendeeProfile'
import type { AttendeeGuideJson } from '@/lib/dancecard/attendeeGuideJson'
import type { EventProfileId } from '@/lib/dancecard/eventProfile'
import type { DancecardThemeConfig } from '@/lib/dancecard/theme'
import { toConventionDatetimeInput } from '@/lib/dancecard/eventWindowTime'

export type EventSettingsEventDto = {
  id: string
  slug: string
  productTitle: string
  eventTitle: string
  subtitle: string | null
  timezone: string
  windowStartsAt: string
  windowEndsAt: string
  sharedByLabel: string
  sharedByDetail: string | null
  logoUrl: string | null
  /** Hero background photo, mirrored from the anchor `events.imageUrl`. Updated via `/hero/upload`. */
  heroImageUrl: string | null
  /** Link preview when sharing convention URL (1200×630). Falls back to hero. */
  shareImageUrl: string | null
  status: string
  staffAccessCode: string
  registrationAccessCode: string
  badgeLayoutJson: Record<string, unknown>
  themeConfig?: DancecardThemeConfig
  eventProfile: EventProfileId
  peopleHubTemplate?: 'full' | 'munch'
  attendeeGuideJson: AttendeeGuideJson
  agreementsConfig: AgreementsConfig
  attendeeProfileConfig: AttendeeProfileConfig
}

export function toLocalDatetimeInput(iso: string, timeZone?: string) {
  if (timeZone) return toConventionDatetimeInput(iso, timeZone)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export { toConventionDatetimeInput, fromConventionDatetimeInput } from '@/lib/dancecard/eventWindowTime'

export function hasEventWindow(event: EventSettingsEventDto) {
  return Boolean(event.windowStartsAt && event.windowEndsAt)
}
