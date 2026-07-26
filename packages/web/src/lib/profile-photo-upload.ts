import {
  getProfilePhotoUploadFeedback,
  isProfilePhotoPendingReviewStatus,
  MEDIA_UPLOAD_STATUSES,
  PROFILE_PHOTO_PENDING_REVIEW_MESSAGE,
  type ProfilePhotoDisplaySettings,
} from '@c2k/shared'

export type ProfilePhotoUploadResult = {
  url: string | null
  quarantineKey: string | null
  sha256: string | null
  mimeType: string
  sizeBytes: number
  originalFilename: string
  imageWidth?: number
  imageHeight?: number
  error?: string
  code?: string
}

export type ProfilePhotoAttachResult =
  | {
      ok: true
      outcome: 'published' | 'pending_review'
      needsAttestation?: boolean
      mediaAssetId?: string
      photoId?: string
      photoUrl?: string
      pendingReview?: boolean
      message?: string
    }
  | { ok: false; outcome: 'rejected'; error: string; code?: string }

// Mobile uploads + VPS image processing can exceed 90s on large camera photos.
const UPLOAD_TIMEOUT_MS = 180_000
const ATTACH_TIMEOUT_MS = 180_000

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  const { timeoutMs = UPLOAD_TIMEOUT_MS, signal: outerSignal, ...rest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onOuterAbort = () => controller.abort()
  outerSignal?.addEventListener('abort', onOuterAbort)
  try {
    return await fetch(input, { ...rest, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (outerSignal?.aborted) {
        throw new Error('Upload cancelled.')
      }
      throw new Error(
        'Upload timed out. Please try again in a moment.',
      )
    }
    if (err instanceof TypeError) {
      throw new Error(
        'Could not reach the upload server. Check your connection and try again.',
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
    outerSignal?.removeEventListener('abort', onOuterAbort)
  }
}

const emptyUploadResult = (file: File): ProfilePhotoUploadResult => ({
  url: null,
  quarantineKey: null,
  sha256: null,
  mimeType: file.type,
  sizeBytes: file.size,
  originalFilename: file.name,
})

/** Upload a profile image via POST /api/upload (quarantine pipeline). */
export async function uploadProfilePhotoFile(
  file: File,
  opts?: { signal?: AbortSignal },
): Promise<ProfilePhotoUploadResult> {
  const fd = new FormData()
  fd.append('purpose', 'profile_photo')
  fd.append('file', file)
  const r = await fetchWithTimeout('/api/upload', {
    method: 'POST',
    body: fd,
    credentials: 'include',
    timeoutMs: UPLOAD_TIMEOUT_MS,
    signal: opts?.signal,
  })
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string }
    return {
      ...emptyUploadResult(file),
      error: typeof j.error === 'string' ? j.error : 'Upload failed.',
      code: j.code,
    }
  }
  const j = (await r.json()) as {
    url?: string | null
    quarantineKey?: string
    key?: string
    sha256?: string
    mimeType?: string
    sizeBytes?: number
    width?: number
    height?: number
  }
  return {
    url: typeof j.url === 'string' ? j.url : null,
    quarantineKey: j.quarantineKey ?? j.key ?? null,
    sha256: j.sha256 ?? null,
    mimeType: j.mimeType || file.type || 'image/jpeg',
    sizeBytes: j.sizeBytes ?? file.size,
    originalFilename: file.name,
    imageWidth: j.width,
    imageHeight: j.height,
  }
}

/** Register a staged upload as a profile gallery photo. */
export async function attachUploadedProfilePhoto(
  uploaded: ProfilePhotoUploadResult,
  sortOrder = 0,
  opts?: {
    signal?: AbortSignal
    caption?: string | null
    displaySettings?: ProfilePhotoDisplaySettings | null
  },
): Promise<ProfilePhotoAttachResult> {
  if (!uploaded.url && !uploaded.quarantineKey) {
    return { ok: false, outcome: 'rejected', error: uploaded.error ?? 'Upload failed.' }
  }
  const r = await fetchWithTimeout('/api/profile/me/photos', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: ATTACH_TIMEOUT_MS,
    signal: opts?.signal,
    body: JSON.stringify({
      url: uploaded.url ?? undefined,
      quarantineKey: uploaded.quarantineKey ?? undefined,
      sha256Hash: uploaded.sha256 ?? undefined,
      imageWidth: uploaded.imageWidth,
      imageHeight: uploaded.imageHeight,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      originalFilename: uploaded.originalFilename,
      sortOrder,
      caption: opts?.caption?.trim() ? opts.caption.trim() : undefined,
      displaySettings: opts?.displaySettings ?? undefined,
    }),
  })
  const data = (await r.json().catch(() => ({}))) as {
    error?: string
    code?: string
    photo?: {
      id?: string
      url?: string
      mediaAssetId?: string | null
      uploadStatus?: string | null
      pendingReview?: boolean
    }
  }
  if (!r.ok) {
    return {
      ok: false,
      outcome: 'rejected',
      error:
        typeof data.error === 'string' ? data.error
        : r.status === 400 ? 'This photo cannot be used as a profile picture.'
        : 'Could not save profile photo.',
      code: data.code,
    }
  }
  const pendingReview =
    data.photo?.pendingReview ?? isProfilePhotoPendingReviewStatus(data.photo?.uploadStatus)
  if (pendingReview) {
    return {
      ok: true,
      outcome: 'pending_review',
      pendingReview: true,
      mediaAssetId: data.photo?.mediaAssetId ?? undefined,
      photoId: data.photo?.id,
      photoUrl: data.photo?.url,
      message: PROFILE_PHOTO_PENDING_REVIEW_MESSAGE,
    }
  }
  const feedback = getProfilePhotoUploadFeedback({ uploadStatus: data.photo?.uploadStatus })
  return {
    ok: true,
    outcome: 'published',
    needsAttestation: data.photo?.uploadStatus === MEDIA_UPLOAD_STATUSES.pendingAttestation,
    mediaAssetId: data.photo?.mediaAssetId ?? undefined,
    photoId: data.photo?.id,
    photoUrl: data.photo?.url,
    message: feedback?.message,
  }
}
