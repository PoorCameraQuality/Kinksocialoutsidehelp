import {
  effectiveFieldVisibility,
  parseProfileFieldVisibility,
  viewerMayMatchDiscoveryField,
  viewerMaySeeProfileField,
  visibleProfileIdentityFields,
  type ProfileFieldVisibilityKey,
} from '@c2k/shared'

export type DiscoveryProfileDbRow = {
  userId: string
  username: string
  displayName: string | null
  bio: string | null
  roles: string[] | null
  verified: boolean | null
  location: string | null
  age: number | null
  avatarUrl: string | null
  lastActiveAt: Date | null
  gender: string | null
  sexuality: string | null
  pronouns: string | null
  discoverableInPeopleSearch: boolean
  fieldVisibility: unknown
}

export type DiscoveryProfileCard = {
  userId: string
  username: string
  displayName: string | null
  bio: string | null
  roles: string[] | null
  verified: boolean | null
  location: string | null
  age: number | null
  sexuality: string | null
  pronouns: string | null
  gender: string | null
  avatarUrl: string | null
  lastActiveAt: string | null
  photoCount?: number
  videoCount?: number
  writingCount?: number
  groupsLedCount?: number
}

export function toDiscoveryProfileCard(
  row: DiscoveryProfileDbRow,
  viewerId: string | null,
  friendIds: Set<string>
): DiscoveryProfileCard {
  const targetUserId = row.userId
  const isSelf = viewerId !== null && viewerId === targetUserId
  const isFriend = viewerId !== null && friendIds.has(targetUserId)
  const map = parseProfileFieldVisibility(row.fieldVisibility)
  const seeCtx = { isOwner: isSelf, isFriend }

  const pick = (key: ProfileFieldVisibilityKey, value: string | number | null): string | number | null => {
    if (value === null || value === undefined) return null
    const level = effectiveFieldVisibility(key, map)
    return viewerMaySeeProfileField(level, seeCtx) ? value : null
  }

  return {
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    roles: row.roles,
    verified: row.verified,
    location: pick('location', row.location) as string | null,
    age: pick('age', row.age) as number | null,
    sexuality: pick('sexuality', row.sexuality) as string | null,
    pronouns: pick('pronouns', row.pronouns) as string | null,
    gender: pick('gender', row.gender) as string | null,
    avatarUrl: row.avatarUrl,
    lastActiveAt: row.lastActiveAt ? row.lastActiveAt.toISOString() : null,
  }
}

export function passesGenderDiscoveryFilter(
  row: Pick<DiscoveryProfileDbRow, 'userId' | 'gender' | 'fieldVisibility'>,
  genderQuery: string,
  viewerId: string | null,
  friendIds: Set<string>
): boolean {
  const trimmed = genderQuery.trim().toLowerCase()
  if (!trimmed) return true
  const g = row.gender?.trim().toLowerCase() ?? ''
  if (!g.includes(trimmed)) return false
  const map = parseProfileFieldVisibility(row.fieldVisibility)
  const level = effectiveFieldVisibility('gender', map)
  const isSelf = viewerId !== null && viewerId === row.userId
  const isFriend = viewerId !== null && friendIds.has(row.userId)
  return viewerMayMatchDiscoveryField(level, { isSelf, isFriend })
}

/** Regional / list surfaces: may this profile appear based on location visibility? */
export function passesLocationDiscoveryFilter(
  row: Pick<DiscoveryProfileDbRow, 'userId' | 'fieldVisibility'>,
  viewerId: string | null,
  friendIds: Set<string>
): boolean {
  const map = parseProfileFieldVisibility(row.fieldVisibility)
  const level = effectiveFieldVisibility('location', map)
  const isSelf = viewerId !== null && viewerId === row.userId
  const isFriend = viewerId !== null && friendIds.has(row.userId)
  return viewerMayMatchDiscoveryField(level, { isSelf, isFriend })
}

/** Redact age/location/gender/pronouns on list cards (home suggestions, blocks, etc.). */
export function redactListProfileIdentityFields<
  T extends {
    userId: string
    age?: number | null
    location?: string | null
    gender?: string | null
    genders?: string[] | null
    pronouns?: string | null
    fieldVisibility?: unknown
  },
>(row: T, viewerId: string | null, friendIds: Set<string>): T {
  const visible = visibleProfileIdentityFields(
    {
      gender: row.gender ?? null,
      age: row.age ?? null,
      sexuality: null,
      pronouns: row.pronouns ?? null,
      genders: row.genders,
      location: row.location ?? null,
      fieldVisibility: row.fieldVisibility,
    },
    {
      isOwner: viewerId !== null && viewerId === row.userId,
      isFriend: viewerId !== null && friendIds.has(row.userId),
    },
  )
  return {
    ...row,
    age: visible.age,
    location: visible.location,
    gender: visible.gender,
    genders: visible.genders,
    pronouns: visible.pronouns,
  }
}

export type RedactProfileForViewerOptions = {
  /** When true, owners see field visibility the same way strangers do (public profile view). */
  asPublicProfileView?: boolean
}

/** Full profile row: owner sees everything unless `asPublicProfileView`; others see redacted sensitive fields and no `fieldVisibility` / `discoverableInPeopleSearch`. */
export function redactProfileForViewer<
  T extends {
    gender: string | null
    age: number | null
    sexuality: string | null
    pronouns: string | null
    genders?: string[] | null
    sexualOrientations?: string[] | null
    romanticOrientations?: string[] | null
    pronounTags?: string[] | null
    fieldVisibility: unknown
    discoverableInPeopleSearch: boolean
    location?: string | null
    geoJson?: unknown
  },
>(
  prof: T,
  ctx: { viewerId: string | null; targetUserId: string; friendIds: Set<string> },
  options?: RedactProfileForViewerOptions
): T | Omit<T, 'fieldVisibility' | 'discoverableInPeopleSearch'> {
  const isOwner = ctx.viewerId !== null && ctx.viewerId === ctx.targetUserId
  if (isOwner && !options?.asPublicProfileView) return prof
  const isFriend = ctx.viewerId !== null && ctx.friendIds.has(ctx.targetUserId)
  const visible = visibleProfileIdentityFields(prof, {
    isOwner,
    isFriend,
    asPublicProfileView: options?.asPublicProfileView,
  })
  const { fieldVisibility: _fv, discoverableInPeopleSearch: _di, ...base } = prof
  const extended = base as T & {
    birthDate?: string | null
    homeZip?: string | null
    placeId?: string | null
    stateId?: string | null
    customLocation?: string | null
    lookingFor?: string[] | null
    notLookingFor?: string[] | null
  }
  const redacted = {
    ...extended,
    location: visible.location,
    gender: visible.gender,
    age: visible.age,
    sexuality: visible.sexuality,
    pronouns: visible.pronouns,
    genders: visible.genders,
    sexualOrientations: visible.sexualOrientations,
    romanticOrientations: visible.romanticOrientations,
    pronounTags: visible.pronounTags,
    geoJson: null,
    lookingFor: isOwner && !options?.asPublicProfileView ? extended.lookingFor : [],
  }
  if (isOwner && options?.asPublicProfileView) {
    return {
      ...redacted,
      birthDate: null,
      homeZip: null,
      placeId: null,
      stateId: null,
      customLocation: null,
      lookingFor: [],
      fieldVisibility: prof.fieldVisibility,
      discoverableInPeopleSearch: prof.discoverableInPeopleSearch,
    }
  }
  return {
    ...redacted,
    birthDate: null,
    homeZip: null,
    placeId: null,
    stateId: null,
    customLocation: null,
    notLookingFor: [],
  }
}
