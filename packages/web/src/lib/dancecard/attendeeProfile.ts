import { z } from 'zod'
import { PROFILE_PHOTO_STORAGE_PREFIX } from '@/lib/dancecard/profilePhotoConstants'
import { assertHttpsImageUrl, assertHttpsUrl } from '@/lib/security/safeUrl'

export type AttendeeContactKind = 'fetlife' | 'discord' | 'telegram' | 'email'

export type AttendeeContactLink = {
  kind: AttendeeContactKind
  label: string
  value: string
  href?: string
}

/** Stored in dancecard_prefs.profile_json */
export const attendeeProfileStoredSchema = z.object({
  pronouns: z.string().max(40).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  photoUrl: z.string().max(2000).nullable().optional(),
  fetlife: z.string().max(80).nullable().optional(),
  discord: z.string().max(80).nullable().optional(),
  telegram: z.string().max(80).nullable().optional(),
  emailOnCard: z.string().email().max(200).nullable().optional(),
})

export type AttendeeProfileStored = z.infer<typeof attendeeProfileStoredSchema>

export const attendeeProfileConfigSchema = z.object({
  photo: z.boolean(),
  bio: z.boolean(),
  pronouns: z.boolean(),
  fetlife: z.boolean(),
  discord: z.boolean(),
  telegram: z.boolean(),
  emailOnCard: z.boolean(),
  bioMaxLength: z.number().int().min(40).max(500),
  bioPrompt: z.string().max(500).nullable(),
})

export type AttendeeProfileConfig = z.infer<typeof attendeeProfileConfigSchema>

export const DEFAULT_ATTENDEE_PROFILE_CONFIG: AttendeeProfileConfig = {
  photo: true,
  bio: true,
  pronouns: true,
  fetlife: true,
  discord: true,
  telegram: false,
  emailOnCard: false,
  bioMaxLength: 280,
  bioPrompt: null,
}

/** Public card shape returned by APIs and rendered on Compare. */
export type AttendeePublicProfile = {
  displayName: string
  loginName: string
  pronouns?: string
  bio?: string
  avatarUrl?: string
  contacts: AttendeeContactLink[]
}

export function parseAttendeeProfileConfig(raw: unknown): AttendeeProfileConfig {
  const parsed = attendeeProfileConfigSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return { ...DEFAULT_ATTENDEE_PROFILE_CONFIG }
}

export function parseProfileStored(raw: unknown): AttendeeProfileStored {
  if (!raw || typeof raw !== 'object') return {}
  const parsed = attendeeProfileStoredSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

function fetlifeHref(username: string): string {
  const clean = username.replace(/^@/, '').trim()
  return `https://fetlife.com/${encodeURIComponent(clean)}`
}

export function buildPublicProfile(input: {
  displayName: string
  username: string
  stored: AttendeeProfileStored
  config: AttendeeProfileConfig
  /** Signed URL when photoUrl is a storage: reference. */
  resolvedPhotoUrl?: string | null
}): AttendeePublicProfile {
  const { displayName, username, stored, config, resolvedPhotoUrl } = input
  const contacts: AttendeeContactLink[] = []

  if (config.fetlife && stored.fetlife?.trim()) {
    const value = stored.fetlife.trim()
    contacts.push({ kind: 'fetlife', label: 'FetLife', value, href: fetlifeHref(value) })
  }
  if (config.discord && stored.discord?.trim()) {
    contacts.push({ kind: 'discord', label: 'Discord', value: stored.discord.trim() })
  }
  if (config.telegram && stored.telegram?.trim()) {
    const value = stored.telegram.trim()
    const rawHref = value.startsWith('http') ? value : `https://t.me/${value.replace(/^@/, '')}`
    const href = assertHttpsUrl(rawHref)
    if (href) contacts.push({ kind: 'telegram', label: 'Telegram', value, href })
    else contacts.push({ kind: 'telegram', label: 'Telegram', value })
  }
  if (config.emailOnCard && stored.emailOnCard?.trim()) {
    const value = stored.emailOnCard.trim()
    contacts.push({ kind: 'email', label: 'Email', value, href: `mailto:${value}` })
  }

  const bioMax = config.bioMaxLength ?? DEFAULT_ATTENDEE_PROFILE_CONFIG.bioMaxLength
  const bioRaw = config.bio ? stored.bio?.trim() : ''
  const bio = bioRaw ? bioRaw.slice(0, bioMax) : undefined

  return {
    displayName,
    loginName: username,
    pronouns: config.pronouns ? stored.pronouns?.trim() || undefined : undefined,
    bio: bio || undefined,
    avatarUrl:
      config.photo && stored.photoUrl?.trim()
        ? resolvedPhotoUrl ??
          (stored.photoUrl.trim().startsWith(PROFILE_PHOTO_STORAGE_PREFIX)
            ? undefined
            : assertHttpsImageUrl(stored.photoUrl.trim()) ?? undefined)
        : undefined,
    contacts,
  }
}

/** PATCH body: only keys present in organizer config are applied. */
export function profilePatchForConfig(
  body: AttendeeProfileStored,
  config: AttendeeProfileConfig
): AttendeeProfileStored {
  const out: AttendeeProfileStored = {}
  if (config.pronouns && body.pronouns !== undefined) out.pronouns = body.pronouns?.trim() || null
  if (config.bio && body.bio !== undefined) {
    const max = config.bioMaxLength ?? 280
    out.bio = body.bio?.trim() ? body.bio.trim().slice(0, max) : null
  }
  if (config.photo && body.photoUrl !== undefined) {
    const raw = body.photoUrl?.trim() || null
    if (!raw) out.photoUrl = null
    else if (raw.startsWith(PROFILE_PHOTO_STORAGE_PREFIX)) out.photoUrl = raw
    else out.photoUrl = assertHttpsImageUrl(raw)
  }
  if (config.fetlife && body.fetlife !== undefined) out.fetlife = body.fetlife?.trim() || null
  if (config.discord && body.discord !== undefined) out.discord = body.discord?.trim() || null
  if (config.telegram && body.telegram !== undefined) out.telegram = body.telegram?.trim() || null
  if (config.emailOnCard && body.emailOnCard !== undefined) out.emailOnCard = body.emailOnCard?.trim() || null
  return out
}

export function mergeProfileStored(
  existing: AttendeeProfileStored,
  patch: AttendeeProfileStored
): AttendeeProfileStored {
  return { ...existing, ...patch }
}
