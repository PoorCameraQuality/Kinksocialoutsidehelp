import { z } from 'zod'

/**
 * Who can see a profile field on the card or in lists. Also gates discovery facets.
 *
 * Stored level friends means accepted mutual connections in current API call sites.
 * Do not rename the stored value without a settings migration. Product copy may say connections.
 */
export const profileFieldVisibilityLevelSchema = z.enum(['public', 'friends', 'hidden'])
export type ProfileFieldVisibilityLevel = z.infer<typeof profileFieldVisibilityLevelSchema>

export const PROFILE_FIELD_VISIBILITY_KEYS = ['gender', 'age', 'sexuality', 'pronouns', 'location'] as const
export type ProfileFieldVisibilityKey = (typeof PROFILE_FIELD_VISIBILITY_KEYS)[number]

/** User-facing labels for profile field visibility controls (`sexuality` gates orientation tags). */
export const PROFILE_FIELD_VISIBILITY_LABELS: Record<ProfileFieldVisibilityKey, string> = {
  gender: 'Gender',
  age: 'Age',
  sexuality: 'Orientation',
  pronouns: 'Pronouns',
  location: 'Location',
}

export function profileFieldVisibilityControlLabel(key: ProfileFieldVisibilityKey): string {
  return `${PROFILE_FIELD_VISIBILITY_LABELS[key]} visibility`
}

export const profileFieldVisibilityMapSchema = z
  .object({
    gender: profileFieldVisibilityLevelSchema.optional(),
    age: profileFieldVisibilityLevelSchema.optional(),
    sexuality: profileFieldVisibilityLevelSchema.optional(),
    pronouns: profileFieldVisibilityLevelSchema.optional(),
    location: profileFieldVisibilityLevelSchema.optional(),
  })
  .strict()
  .optional()

export type ProfileFieldVisibilityMap = Partial<Record<ProfileFieldVisibilityKey, ProfileFieldVisibilityLevel>>

export function parseProfileFieldVisibility(raw: unknown): ProfileFieldVisibilityMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const out: ProfileFieldVisibilityMap = {}
  for (const k of PROFILE_FIELD_VISIBILITY_KEYS) {
    const v = o[k]
    if (v === 'public' || v === 'friends' || v === 'hidden') {
      out[k] = v
    }
  }
  return out
}

export function effectiveFieldVisibility(
  key: ProfileFieldVisibilityKey,
  map: ProfileFieldVisibilityMap
): ProfileFieldVisibilityLevel {
  return map[key] ?? 'public'
}

/**
 * Profile view / card: may the viewer see this field’s value?
 * For level `'friends'`, `ctx.isFriend` must mean an accepted mutual connection.
 */
export function viewerMaySeeProfileField(
  level: ProfileFieldVisibilityLevel,
  ctx: { isOwner: boolean; isFriend: boolean }
): boolean {
  if (ctx.isOwner) return true
  if (level === 'hidden') return false
  if (level === 'public') return true
  return ctx.isFriend
}

/**
 * Discovery: may this field’s stored value be used to include the user in a facet filter for this viewer?
 * Same `'friends'` → mutual connection semantics as `viewerMaySeeProfileField`.
 */
export function viewerMayMatchDiscoveryField(
  level: ProfileFieldVisibilityLevel,
  ctx: { isSelf: boolean; isFriend: boolean }
): boolean {
  if (ctx.isSelf) return true
  if (level === 'hidden') return false
  if (level === 'public') return true
  return ctx.isFriend
}

export type ProfileIdentityForVisibility = {
  gender: string | null
  age: number | null
  sexuality: string | null
  pronouns: string | null
  genders?: string[] | null
  sexualOrientations?: string[] | null
  romanticOrientations?: string[] | null
  pronounTags?: string[] | null
  location?: string | null
  fieldVisibility: unknown
}

export type VisibleProfileIdentity = {
  gender: string | null
  age: number | null
  sexuality: string | null
  pronouns: string | null
  genders: string[]
  sexualOrientations: string[]
  romanticOrientations: string[]
  pronounTags: string[]
  location: string | null
}

/** Apply per-field visibility for profile display (`asPublicProfileView` makes owners see what others see). */
export function visibleProfileIdentityFields(
  prof: ProfileIdentityForVisibility,
  ctx: { isOwner: boolean; isFriend: boolean; asPublicProfileView?: boolean }
): VisibleProfileIdentity {
  const applyVisibility = !ctx.isOwner || ctx.asPublicProfileView
  const map = parseProfileFieldVisibility(prof.fieldVisibility)
  const seeCtx =
    applyVisibility ?
      { isOwner: false, isFriend: ctx.asPublicProfileView && ctx.isOwner ? false : ctx.isFriend }
    : { isOwner: true, isFriend: ctx.isFriend }

  const pick = (key: ProfileFieldVisibilityKey, value: string | number | null): string | number | null => {
    if (value === null || value === undefined) return null
    const level = effectiveFieldVisibility(key, map)
    return viewerMaySeeProfileField(level, seeCtx) ? value : null
  }

  const pickArray = (key: ProfileFieldVisibilityKey, values: string[] | null | undefined): string[] => {
    if (!values?.length) return []
    const level = effectiveFieldVisibility(key, map)
    return viewerMaySeeProfileField(level, seeCtx) ? values : []
  }

  return {
    gender: pick('gender', prof.gender) as string | null,
    age: pick('age', prof.age) as number | null,
    sexuality: pick('sexuality', prof.sexuality) as string | null,
    pronouns: pick('pronouns', prof.pronouns) as string | null,
    genders: pickArray('gender', prof.genders),
    sexualOrientations: pickArray('sexuality', prof.sexualOrientations),
    romanticOrientations: pickArray('sexuality', prof.romanticOrientations),
    pronounTags: pickArray('pronouns', prof.pronounTags),
    location: pick('location', prof.location ?? null) as string | null,
  }
}
