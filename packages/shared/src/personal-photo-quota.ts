/** Max distinct personal images across profile photos + member gallery (alpha). */
export const MAX_PERSONAL_PHOTOS = 100

/** Show a heads-up in UI when remaining slots drop to this count or below. */
export const PERSONAL_PHOTO_NEAR_LIMIT_THRESHOLD = 10

export type PersonalPhotoQuota = {
  limit: number
  used: number
  remaining: number
  atLimit: boolean
  nearLimit: boolean
}

export function buildPersonalPhotoQuota(used: number, limit = MAX_PERSONAL_PHOTOS): PersonalPhotoQuota {
  const safeUsed = Math.max(0, used)
  const safeLimit = Math.max(1, limit)
  const remaining = Math.max(0, safeLimit - safeUsed)
  return {
    limit: safeLimit,
    used: safeUsed,
    remaining,
    atLimit: remaining <= 0,
    nearLimit: remaining > 0 && remaining <= PERSONAL_PHOTO_NEAR_LIMIT_THRESHOLD,
  }
}

export const PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE =
  'You have reached the 100-photo limit for your profile and gallery. Remove a photo before uploading more.'

export function personalPhotoQuotaStatusMessage(quota: PersonalPhotoQuota): string | null {
  if (quota.atLimit) return PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE
  if (quota.nearLimit) {
    return `${quota.remaining} photo slot${quota.remaining === 1 ? '' : 's'} left (${quota.used} of ${quota.limit} used).`
  }
  return null
}

export function personalPhotoQuotaInlineLabel(quota: PersonalPhotoQuota): string {
  return `${quota.used} / ${quota.limit} photos`
}
