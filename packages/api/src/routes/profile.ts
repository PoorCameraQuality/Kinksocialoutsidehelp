import {
  ageFromBirthDate,
  capArray,
  formatMemberSinceMonthYear,
  formatPlaceLocationLabel,
  formatPronounDisplay,
  parseLegacySexualityLabels,
  parseProfileFieldVisibility,
  parsePronounTags,
  PROFILE_GENDER_MAX,
  PROFILE_ORIENTATION_MAX,
  PROFILE_ROLE_MAX,
  PUBLIC_PROFILE_KINK_STATUSES,
  profileFieldVisibilityLevelSchema,
} from '@c2k/shared'
import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { getAlphaLabelForTarget } from '../lib/alpha-seed-labels.js'
import { loadAcceptedFriendUserIds } from '../lib/accepted-friends.js'
import { redactProfileForViewer } from '../lib/profile-field-redaction.js'
import { canViewerReadIsoVisibility } from '../lib/iso-access.js'
import { canViewerReadProfile, canViewerReadProfileEmail } from '../lib/profile-access.js'
import { isBlockedPair } from '../lib/blocks.js'
import { rejectIfUserIdentityBanned } from '../lib/moderation-route-auth.js'
import { ensureProfileForUserId } from '../lib/ensure-profile.js'
import { resolveZipPlace } from '../lib/zip-place-lookup.js'
import { loadProfilePhotos, loadPublicProfilePhotos } from './profile-photos.js'
import { resolveProfileConnectionsAccess } from '../lib/profile-connections.js'
import {
  resolveProfileSocialSummary,
  type ProfileFollowsSummaryPayload,
  type SocialPersonPreview,
} from '../lib/profile-social-summary.js'
import { getEmailFromUserRow } from '../lib/user-email.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

const PUBLIC_KINK_STATUSES = new Set<string>(PUBLIC_PROFILE_KINK_STATUSES)

async function loadProfileKinks(profileId: string) {
  return db
    .select({
      kinkTagId: schema.profileKinks.kinkTagId,
      interestStatus: schema.profileKinks.interestStatus,
      activity: schema.profileKinks.activity,
      note: schema.profileKinks.note,
      slug: schema.kinkTags.slug,
      displayName: schema.kinkTags.displayName,
    })
    .from(schema.profileKinks)
    .innerJoin(schema.kinkTags, eq(schema.profileKinks.kinkTagId, schema.kinkTags.id))
    .where(eq(schema.profileKinks.profileId, profileId))
}

const fieldVisibilityPatchSchema = z
  .object({
    gender: profileFieldVisibilityLevelSchema.optional(),
    age: profileFieldVisibilityLevelSchema.optional(),
    sexuality: profileFieldVisibilityLevelSchema.optional(),
    pronouns: profileFieldVisibilityLevelSchema.optional(),
    location: profileFieldVisibilityLevelSchema.optional(),
  })
  .strict()
  .optional()

const patchBody = z.object({
  bio: z.union([z.string(), z.null()]).optional(),
  location: z.union([z.string(), z.null()]).optional(),
  displayName: z.union([z.string(), z.null()]).optional(),
  roles: z.array(z.string()).optional(),
  gender: z.union([z.string().max(64), z.null()]).optional(),
  sexuality: z.string().max(128).optional(),
  pronouns: z.string().optional(),
  genders: z.array(z.string()).optional(),
  sexualOrientations: z.array(z.string()).optional(),
  romanticOrientations: z.array(z.string()).optional(),
  pronounTags: z.array(z.string()).optional(),
  lifestyleActivity: z.union([z.string().max(128), z.null()]).optional(),
  lookingFor: z.array(z.string()).optional(),
  notLookingFor: z.array(z.string()).optional(),
  homeZip: z.union([z.string().max(10), z.null()]).optional(),
  zipPlaceId: z.union([z.string().uuid(), z.null()]).optional(),
  age: z.number().int().min(18).max(120).optional(),
  birthDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
  discoverableInPeopleSearch: z.boolean().optional(),
  visibility: z.enum(['PUBLIC', 'MEMBERS', 'PRIVATE']).optional(),
  fieldVisibility: fieldVisibilityPatchSchema,
  placeId: z.union([z.string().uuid(), z.null()]).optional(),
  stateId: z.union([z.string().uuid(), z.null()]).optional(),
  customLocation: z.union([z.string().max(255), z.null()]).optional(),
})

type ProfileRow = typeof schema.profiles.$inferSelect

function legacySexualityToArray(sexuality: string | null): string[] {
  return parseLegacySexualityLabels(sexuality)
}

/** Populate array fields from legacy varchar when arrays are empty. */
export function enrichProfileIdentityRead<T extends ProfileRow>(prof: T): T {
  const genders =
    prof.genders?.length ? prof.genders
    : prof.gender ? [prof.gender]
    : []
  const sexualOrientations =
    prof.sexualOrientations?.length ? prof.sexualOrientations
    : legacySexualityToArray(prof.sexuality)
  const romanticOrientations = prof.romanticOrientations?.length ? prof.romanticOrientations : []
  const pronounTags =
    prof.pronounTags?.length ? prof.pronounTags
    : parsePronounTags(prof.pronouns)

  return {
    ...prof,
    genders,
    sexualOrientations,
    romanticOrientations,
    pronounTags,
  }
}

function syncLegacyIdentityFields(
  genders: string[],
  sexualOrientations: string[],
  pronounTags: string[]
): { gender: string | null; sexuality: string | null; pronouns: string | null } {
  const gender = genders[0] ?? null
  const sexuality =
    sexualOrientations.length > 0 ?
      sexualOrientations.join(', ').slice(0, 128)
    : null
  const pronouns = pronounTags.length > 0 ? formatPronounDisplay(pronounTags) || null : null
  return { gender, sexuality, pronouns }
}

async function resolveLocationFromPatch(
  u: z.infer<typeof patchBody>,
  prof: ProfileRow
): Promise<
  | {
      ok: true
      location: string | null
      placeId: string | null
      stateId: string | null
      customLocation: string | null
    }
  | { ok: false; status: 400; error: string }
> {
  if (u.zipPlaceId !== undefined) {
    if (u.zipPlaceId === null) {
      return {
        ok: true,
        location: u.location !== undefined ? u.location ?? null : prof.location,
        placeId: null,
        stateId: u.stateId !== undefined ? u.stateId : prof.stateId,
        customLocation: u.customLocation !== undefined ? u.customLocation : prof.customLocation,
      }
    }
    const [row] = await db
      .select({
        placeName: schema.places.name,
        stateId: schema.places.stateId,
        stateName: schema.states.name,
      })
      .from(schema.places)
      .innerJoin(schema.states, eq(schema.places.stateId, schema.states.id))
      .where(eq(schema.places.id, u.zipPlaceId))
      .limit(1)
    if (!row) {
      return { ok: false, status: 400, error: 'Invalid zipPlaceId' }
    }
    return {
      ok: true,
      location: formatPlaceLocationLabel(row.placeName, row.stateName),
      placeId: u.zipPlaceId,
      stateId: row.stateId,
      customLocation: null,
    }
  }

  const hasStructured =
    u.placeId !== undefined || u.stateId !== undefined || u.customLocation !== undefined

  if (!hasStructured) {
    return {
      ok: true,
      location: u.location !== undefined ? u.location ?? null : prof.location,
      placeId: prof.placeId,
      stateId: prof.stateId,
      customLocation: prof.customLocation,
    }
  }

  const nextPlaceId = u.placeId !== undefined ? u.placeId : prof.placeId
  const nextStateId = u.stateId !== undefined ? u.stateId : prof.stateId
  const nextCustomRaw = u.customLocation !== undefined ? u.customLocation : prof.customLocation

  const customTrim =
    nextCustomRaw != null && String(nextCustomRaw).trim().length > 0 ? String(nextCustomRaw).trim() : null

  if (customTrim) {
    return {
      ok: true,
      location: customTrim,
      placeId: null,
      stateId: nextStateId ?? null,
      customLocation: customTrim,
    }
  }

  if (nextPlaceId) {
    const [row] = await db
      .select({
        placeName: schema.places.name,
        stateId: schema.places.stateId,
        stateName: schema.states.name,
      })
      .from(schema.places)
      .innerJoin(schema.states, eq(schema.places.stateId, schema.states.id))
      .where(eq(schema.places.id, nextPlaceId))
      .limit(1)
    if (!row) {
      return { ok: false, status: 400, error: 'Invalid placeId' }
    }
    return {
      ok: true,
      location: formatPlaceLocationLabel(row.placeName, row.stateName),
      placeId: nextPlaceId,
      stateId: row.stateId,
      customLocation: null,
    }
  }

  if (nextStateId) {
    const [st] = await db.select({ name: schema.states.name }).from(schema.states).where(eq(schema.states.id, nextStateId)).limit(1)
    if (!st) {
      return { ok: false, status: 400, error: 'Invalid stateId' }
    }
    return {
      ok: true,
      location: st.name,
      placeId: null,
      stateId: nextStateId,
      customLocation: null,
    }
  }

  return {
    ok: true,
    location: u.location !== undefined ? u.location ?? null : null,
    placeId: null,
    stateId: null,
    customLocation: null,
  }
}

export async function registerProfileRoutes(app: FastifyInstance) {
  app.get('/api/profile/:username', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile API requires USE_DATABASE=true' })
    }
    const { username } = req.params as { username: string }
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
    if (!user) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const isOwner = viewerId !== null && viewerId === user.id
    if (!isOwner && viewerId && (await isBlockedPair(viewerId, user.id))) {
      return reply.status(404).send({ error: 'Not found' })
    }
    let profile = (
      await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).limit(1)
    )[0]
    if (!profile && isOwner) {
      profile = await ensureProfileForUserId(user.id)
    }
    if (
      profile &&
      !canViewerReadProfile(profile.visibility, { viewerId, isOwner })
    ) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const friendIds =
      viewerId ? await loadAcceptedFriendUserIds(viewerId) : new Set<string>()
    const enriched = profile ? enrichProfileIdentityRead(profile) : profile
    const safeProfile =
      enriched ?
        redactProfileForViewer(enriched, { viewerId, targetUserId: user.id, friendIds }, { asPublicProfileView: true })
      : enriched

    const payload: {
      user: { id: string; username: string; email?: string; memberSince: string }
      profile: typeof enriched
      kinks?: Awaited<ReturnType<typeof loadProfileKinks>>
      iso?: {
        body: string
        visibility: string
        acceptDmsViaIso: boolean
        updatedAt: string
        images: { sortOrder: number; url: string }[]
      }
      photos?: Awaited<ReturnType<typeof loadProfilePhotos>>
      connectionsSummary?: {
        totalCount: number
        mutualCount: number | null
        listVisible: boolean
        preview: SocialPersonPreview[]
      }
      followsSummary?: ProfileFollowsSummaryPayload
      mutualConnections?: {
        count: number | null
        preview: SocialPersonPreview[]
      }
    } = {
      user: {
        id: user.id,
        username: user.username,
        memberSince: formatMemberSinceMonthYear(user.createdAt),
      },
      profile: safeProfile as typeof enriched,
    }
    if (canViewerReadProfileEmail(isOwner)) {
      const email = getEmailFromUserRow(user)
      if (email) payload.user.email = email
    }
    if (profile) {
      const canSeeKinks =
        isOwner ||
        profile.visibility === 'PUBLIC' ||
        (profile.visibility === 'MEMBERS' && viewerId !== null)
      if (canSeeKinks) {
        let kinks = await loadProfileKinks(profile.id)
        if (!isOwner) {
          kinks = kinks.filter((k) => PUBLIC_KINK_STATUSES.has(k.interestStatus))
        }
        payload.kinks = kinks
        payload.photos = isOwner
          ? await loadProfilePhotos(profile.id)
          : await loadPublicProfilePhotos(profile.id)
      }
      const [isoPost] = await db.select().from(schema.userIsoPosts).where(eq(schema.userIsoPosts.userId, user.id)).limit(1)
      if (
        isoPost &&
        canViewerReadIsoVisibility(isoPost.visibility as 'PUBLIC' | 'MEMBERS' | 'PRIVATE', {
          viewerId,
          isOwner,
        })
      ) {
        const images = await db
          .select({ sortOrder: schema.userIsoImages.sortOrder, url: schema.userIsoImages.url })
          .from(schema.userIsoImages)
          .where(eq(schema.userIsoImages.userId, user.id))
          .orderBy(asc(schema.userIsoImages.sortOrder))
        payload.iso = {
          body: isoPost.body,
          visibility: isoPost.visibility,
          acceptDmsViaIso: isoPost.acceptDmsViaIso,
          updatedAt: isoPost.updatedAt.toISOString(),
          images,
        }
      }
      const connectionsAccess = await resolveProfileConnectionsAccess(user.id, viewerId)
      const social = await resolveProfileSocialSummary(user.id, viewerId, connectionsAccess)
      payload.connectionsSummary = {
        totalCount: social.connections.totalCount,
        mutualCount: social.connections.mutualCount,
        listVisible: social.connections.listVisible,
        preview: social.connections.preview,
      }
      payload.followsSummary = social.follows
      payload.mutualConnections = social.mutualConnections
    }

    const alphaLabel = await getAlphaLabelForTarget('user', user.id)
    return reply.send(alphaLabel ? { ...payload, alphaLabel } : payload)
  })

  app.get('/api/profile/me', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }
    const profile = enrichProfileIdentityRead(await ensureProfileForUserId(user.id))
    const kinks = await loadProfileKinks(profile.id)
    const photos = await loadProfilePhotos(profile.id)
    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        email: getEmailFromUserRow(user) ?? undefined,
        memberSince: formatMemberSinceMonthYear(user.createdAt),
      },
      profile,
      bio: profile.bio,
      location: profile.location,
      customLocation: profile.customLocation,
      placeId: profile.placeId,
      stateId: profile.stateId,
      homeZip: profile.homeZip,
      displayName: profile.displayName,
      roles: profile.roles,
      gender: profile.gender,
      sexuality: profile.sexuality,
      pronouns: profile.pronouns,
      genders: profile.genders,
      sexualOrientations: profile.sexualOrientations,
      romanticOrientations: profile.romanticOrientations,
      pronounTags: profile.pronounTags,
      lifestyleActivity: profile.lifestyleActivity,
      lookingFor: profile.lookingFor,
      notLookingFor: profile.notLookingFor,
      age: profile.age,
      birthDate: profile.birthDate,
      discoverableInPeopleSearch: profile.discoverableInPeopleSearch,
      fieldVisibility: profile.fieldVisibility,
      kinks,
      photos,
    })
  })

  app.patch('/api/profile/me', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    if (await rejectIfUserIdentityBanned(userId, reply)) return
    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) {
      req.log.warn(
        { userId, validation: parsed.error.flatten() },
        'PATCH /api/profile/me validation failed',
      )
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }
    const prof = enrichProfileIdentityRead(await ensureProfileForUserId(user.id))
    const u = parsed.data

    if (u.age !== undefined && u.birthDate === undefined) {
      return reply.status(400).send({ error: 'Age cannot be set directly; provide birthDate instead' })
    }

    let nextGenders = prof.genders
    if (u.genders !== undefined) {
      nextGenders = capArray(u.genders, PROFILE_GENDER_MAX)
    } else if (u.gender !== undefined) {
      nextGenders = u.gender ? capArray([u.gender], PROFILE_GENDER_MAX) : []
    }

    let nextSexual = prof.sexualOrientations
    if (u.sexualOrientations !== undefined) {
      nextSexual = capArray(u.sexualOrientations, PROFILE_ORIENTATION_MAX)
    } else if (u.sexuality !== undefined) {
      nextSexual = capArray(legacySexualityToArray(u.sexuality), PROFILE_ORIENTATION_MAX)
    }

    let nextRomantic = prof.romanticOrientations
    if (u.romanticOrientations !== undefined) {
      nextRomantic = capArray(u.romanticOrientations, PROFILE_ORIENTATION_MAX)
    }

    let nextPronounTags = prof.pronounTags
    if (u.pronounTags !== undefined) {
      nextPronounTags = capArray(u.pronounTags, 3)
    } else if (u.pronouns !== undefined) {
      nextPronounTags = parsePronounTags(u.pronouns)
    }

    const nextRoles =
      u.roles !== undefined ? capArray(u.roles, PROFILE_ROLE_MAX) : prof.roles

    if (u.homeZip !== undefined && u.homeZip !== null && String(u.homeZip).trim() !== '') {
      const zipDigits = String(u.homeZip).trim().replace(/\D/g, '').slice(0, 5)
      if (zipDigits.length !== 5) {
        return reply.status(400).send({ error: 'homeZip must be a 5-digit US zip' })
      }
    }

    const loc = await resolveLocationFromPatch(u, prof)
    if (!loc.ok) {
      return reply.status(loc.status).send({ error: loc.error })
    }

    let resolvedHomeZip = u.homeZip !== undefined ? u.homeZip : prof.homeZip
    if (u.zipPlaceId && u.homeZip) {
      const zipLookup = await resolveZipPlace(u.homeZip)
      if (!zipLookup || zipLookup.placeId !== u.zipPlaceId) {
        return reply.status(400).send({ error: 'zipPlaceId does not match homeZip lookup' })
      }
      resolvedHomeZip = zipLookup.zip
    }

    const mergedVisibility =
      u.fieldVisibility !== undefined
        ? { ...parseProfileFieldVisibility(prof.fieldVisibility), ...u.fieldVisibility }
        : prof.fieldVisibility

    let nextBirthDate = prof.birthDate
    if (u.birthDate !== undefined) {
      nextBirthDate = u.birthDate
    }
    let nextAge = u.age !== undefined ? u.age : prof.age
    if (u.birthDate !== undefined) {
      if (u.birthDate === null) {
        nextAge = u.age !== undefined ? u.age : null
      } else {
        const computed = ageFromBirthDate(u.birthDate)
        if (computed == null || computed < 18) {
          return reply.status(400).send({ error: 'Birth date must indicate age 18 or older' })
        }
        nextAge = computed
      }
    }

    const legacy = syncLegacyIdentityFields(nextGenders, nextSexual, nextPronounTags)

    let updated
    try {
      ;[updated] = await db
        .update(schema.profiles)
        .set({
          ...(u.bio !== undefined ? { bio: u.bio } : {}),
          location: loc.location,
          placeId: loc.placeId,
          stateId: loc.stateId,
          customLocation: loc.customLocation,
          ...(u.homeZip !== undefined ? { homeZip: resolvedHomeZip } : {}),
          ...(u.displayName !== undefined ? { displayName: u.displayName } : {}),
          roles: nextRoles,
          genders: nextGenders,
          sexualOrientations: nextSexual,
          romanticOrientations: nextRomantic,
          pronounTags: nextPronounTags,
          lifestyleActivity:
            u.lifestyleActivity !== undefined ? u.lifestyleActivity : prof.lifestyleActivity,
          lookingFor: u.lookingFor !== undefined ? capArray(u.lookingFor, 20) : prof.lookingFor,
          notLookingFor:
            u.notLookingFor !== undefined ? capArray(u.notLookingFor, 20) : prof.notLookingFor,
          gender: legacy.gender,
          sexuality: legacy.sexuality,
          pronouns: legacy.pronouns,
          birthDate: nextBirthDate,
          age: nextAge,
          discoverableInPeopleSearch:
            u.discoverableInPeopleSearch !== undefined ?
              u.discoverableInPeopleSearch
            : prof.discoverableInPeopleSearch,
          ...(u.visibility !== undefined ? { visibility: u.visibility } : {}),
          fieldVisibility: mergedVisibility,
          updatedAt: new Date(),
        })
        .where(eq(schema.profiles.id, prof.id))
        .returning()
    } catch (err) {
      req.log.error(
        {
          userId,
          profileId: prof.id,
          changedKeys: Object.keys(u),
          err: err instanceof Error ? err.message : String(err),
        },
        'PATCH /api/profile/me database update failed',
      )
      return reply.status(500).send({ error: 'Could not save profile' })
    }
    return reply.send({ profile: enrichProfileIdentityRead(updated!) })
  })
}
