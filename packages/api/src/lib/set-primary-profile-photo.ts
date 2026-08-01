/**
 * Shared transactional service for promoting a profile_photos row to primary
 * (sort_order = 0) and syncing profiles.avatar_url.
 */
import { and, asc, eq, ne } from 'drizzle-orm'

import { db, schema } from '../db/index.js'
import {
  isPhotoAvatarEligible,
  loadProfilePhotos,
  mapPhotoRow,
  syncProfileAvatarUrl,
  type ProfilePhotoDto,
} from './profile-photo-gallery.js'

export class SetPrimaryProfilePhotoError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'not_eligible' | 'forbidden' | 'already_primary',
  ) {
    super(message)
    this.name = 'SetPrimaryProfilePhotoError'
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Demote every sort_order = 0 row for a profile by pushing them past current max.
 * Call inside a transaction before inserting/updating a new primary.
 */
export async function demotePrimaryProfilePhotos(
  tx: Tx,
  profileId: string,
  exceptPhotoId?: string,
): Promise<void> {
  const conditions = [
    eq(schema.profilePhotos.profileId, profileId),
    eq(schema.profilePhotos.sortOrder, 0),
  ]
  if (exceptPhotoId) conditions.push(ne(schema.profilePhotos.id, exceptPhotoId))

  const atZero = await tx
    .select({ id: schema.profilePhotos.id, sortOrder: schema.profilePhotos.sortOrder })
    .from(schema.profilePhotos)
    .where(and(...conditions))
  if (atZero.length === 0) return

  const allOrders = await tx
    .select({ sortOrder: schema.profilePhotos.sortOrder })
    .from(schema.profilePhotos)
    .where(eq(schema.profilePhotos.profileId, profileId))
  const maxOrder = allOrders.reduce(
    (max: number, r: { sortOrder: number }) => Math.max(max, r.sortOrder),
    0,
  )
  let nextOrder = maxOrder + 1
  for (const prior of atZero) {
    await tx
      .update(schema.profilePhotos)
      .set({ sortOrder: nextOrder })
      .where(eq(schema.profilePhotos.id, prior.id))
    nextOrder += 1
  }
}

/**
 * Normalize orders to 0..n-1 with preferred primary at 0.
 */
export async function normalizeProfilePhotoOrdering(
  tx: Tx,
  profileId: string,
  preferredPrimaryId?: string,
): Promise<void> {
  const rows = await tx
    .select()
    .from(schema.profilePhotos)
    .where(eq(schema.profilePhotos.profileId, profileId))
    .orderBy(asc(schema.profilePhotos.sortOrder), asc(schema.profilePhotos.createdAt))

  if (rows.length === 0) return

  let primaryId = preferredPrimaryId
  if (!primaryId) {
    const atZero = rows.find((r) => r.sortOrder === 0)
    primaryId = atZero?.id ?? rows[0]!.id
  }

  const ordered = [
    ...rows.filter((r) => r.id === primaryId),
    ...rows.filter((r) => r.id !== primaryId),
  ]

  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i]!
    if (row.sortOrder !== i) {
      await tx
        .update(schema.profilePhotos)
        .set({ sortOrder: i })
        .where(eq(schema.profilePhotos.id, row.id))
    }
  }
}

export type SetPrimaryProfilePhotoResult = {
  primaryPhoto: ProfilePhotoDto
  avatarUrl: string | null
  photos: ProfilePhotoDto[]
}

/**
 * Promote an existing profile_photos row to primary.
 * Pending / quarantined photos are rejected.
 */
export async function setPrimaryProfilePhoto(input: {
  profileId: string
  photoId: string
  actorUserId: string
}): Promise<SetPrimaryProfilePhotoResult> {
  const { profileId, photoId } = input

  const [row] = await db
    .select({
      photo: schema.profilePhotos,
      media: schema.mediaAssets,
    })
    .from(schema.profilePhotos)
    .leftJoin(schema.mediaAssets, eq(schema.profilePhotos.mediaAssetId, schema.mediaAssets.id))
    .where(and(eq(schema.profilePhotos.id, photoId), eq(schema.profilePhotos.profileId, profileId)))
    .limit(1)

  if (!row) {
    throw new SetPrimaryProfilePhotoError('Photo not found', 'not_found')
  }

  const dto = mapPhotoRow(row.photo, row.media)
  if (!isPhotoAvatarEligible(dto)) {
    throw new SetPrimaryProfilePhotoError(
      'This photo is not eligible to be your profile picture yet. Wait for review to finish, or choose another photo.',
      'not_eligible',
    )
  }

  if (row.photo.sortOrder === 0) {
    const photos = await loadProfilePhotos(profileId)
    const primary = photos.find((p) => p.id === photoId) ?? dto
    return {
      primaryPhoto: primary,
      avatarUrl: primary.url?.trim() || null,
      photos,
    }
  }

  await db.transaction(async (tx) => {
    await demotePrimaryProfilePhotos(tx, profileId, photoId)
    await tx
      .update(schema.profilePhotos)
      .set({ sortOrder: 0 })
      .where(eq(schema.profilePhotos.id, photoId))
    await normalizeProfilePhotoOrdering(tx, profileId, photoId)
  })

  await syncProfileAvatarUrl(profileId)

  const photos = await loadProfilePhotos(profileId)
  const primaryPhoto = photos.find((p) => p.id === photoId) ?? photos.find((p) => p.order === 0)
  if (!primaryPhoto) {
    throw new SetPrimaryProfilePhotoError('Photo not found after promotion', 'not_found')
  }

  const [profile] = await db
    .select({ avatarUrl: schema.profiles.avatarUrl })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, profileId))
    .limit(1)

  return {
    primaryPhoto,
    avatarUrl: profile?.avatarUrl ?? primaryPhoto.url,
    photos,
  }
}

/**
 * After deleting a profile photo, promote the first eligible remaining photo
 * (or clear avatar when none remain).
 */
export async function repairPrimaryAfterProfilePhotoDelete(profileId: string): Promise<void> {
  const photos = await loadProfilePhotos(profileId)
  if (photos.length === 0) {
    await db
      .update(schema.profiles)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(schema.profiles.id, profileId))
    return
  }

  const hasEligiblePrimary = photos.some((p) => p.order === 0 && isPhotoAvatarEligible(p))
  if (hasEligiblePrimary) {
    await db.transaction(async (tx) => {
      await normalizeProfilePhotoOrdering(tx, profileId)
    })
    await syncProfileAvatarUrl(profileId)
    return
  }

  const next = photos.find((p) => isPhotoAvatarEligible(p)) ?? photos[0]!
  await db.transaction(async (tx) => {
    await demotePrimaryProfilePhotos(tx, profileId, next.id)
    await tx
      .update(schema.profilePhotos)
      .set({ sortOrder: 0 })
      .where(eq(schema.profilePhotos.id, next.id))
    await normalizeProfilePhotoOrdering(tx, profileId, next.id)
  })
  await syncProfileAvatarUrl(profileId)
}

/**
 * Ensure a profile_photos row exists for a media asset, then promote it.
 * Used by media_items "use as avatar" so there is one primary-photo path.
 */
export async function ensureProfilePhotoAndSetPrimary(input: {
  profileId: string
  mediaAssetId: string
  actorUserId: string
  url: string
  caption?: string | null
}): Promise<SetPrimaryProfilePhotoResult> {
  const { profileId, mediaAssetId, url, caption } = input

  const [existing] = await db
    .select()
    .from(schema.profilePhotos)
    .where(
      and(
        eq(schema.profilePhotos.profileId, profileId),
        eq(schema.profilePhotos.mediaAssetId, mediaAssetId),
      ),
    )
    .limit(1)

  let photoId = existing?.id
  if (!photoId) {
    const existingCount = await db
      .select({ sortOrder: schema.profilePhotos.sortOrder })
      .from(schema.profilePhotos)
      .where(eq(schema.profilePhotos.profileId, profileId))
    const maxOrder = existingCount.reduce(
      (max, r) => Math.max(max, r.sortOrder),
      -1,
    )
    const [inserted] = await db
      .insert(schema.profilePhotos)
      .values({
        profileId,
        mediaAssetId,
        url,
        caption: caption ?? null,
        sortOrder: maxOrder + 1,
      })
      .returning()
    photoId = inserted!.id
  } else {
    const patch: { url: string; caption?: string | null } = { url }
    if (caption !== undefined) patch.caption = caption ?? null
    await db
      .update(schema.profilePhotos)
      .set(patch)
      .where(eq(schema.profilePhotos.id, existing.id))
  }

  return setPrimaryProfilePhoto({
    profileId,
    photoId,
    actorUserId: input.actorUserId,
  })
}
