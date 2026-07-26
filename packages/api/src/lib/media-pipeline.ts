import { createHash, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import {
  MAX_VIDEO_UPLOAD_BYTES,
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  SCAN_STATUSES,
  isMediaPublishedStatus,
  isPublicStorageState,
  uploadLimitMegabytes,
  visibilityAllowsAnonymousDirectUrl,
  type MediaPublishLane,
  type MediaUploadStatus,
  type ScanStatus,
  type ScannerResultRecord,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import type { MediaAsset } from '../db/schema.js'
import { defaultMediaScanner, type MediaScannerAdapter } from './media-scanner.js'
import { sanitizeImageBuffer } from './media-sanitize.js'
import {
  defaultBucket,
  getS3Client,
  promoteQuarantineToPublic,
  publicMediaObjectKey,
  publicUrlForKey,
  isBrowserReachablePublicUrl,
  putObject,
  quarantineObjectKey,
} from './s3-upload.js'
import {
  audioValidationErrorMessage,
  validateAudioUploadBuffer,
  validateImageUploadBuffer,
  validationErrorMessage,
  type AllowedImageMime,
} from './media-upload-validate.js'
import { explicitMediaAllowsPublicUrl } from './media-visibility.js'
import { syncProfilePhotoServingUrlsForAsset } from './sync-profile-media-serving-urls.js'
import type { MediaContentRating, MediaVisibility } from '@c2k/shared'

export class MediaUploadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaUploadValidationError'
  }
}

export type ProcessedUploadResult = {
  quarantineKey: string
  sha256Hash: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  storageBucket: string
  exifStripped: boolean
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function extensionFromMime(mime: AllowedImageMime): string {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  return '.gif'
}

/** Validate, sanitize, hash, and store upload in quarantine prefix - no public URL. */
export async function processIncomingImageUpload(params: {
  userId: string
  buffer: Buffer
  filename: string
  declaredMime?: string | null
}): Promise<ProcessedUploadResult> {
  const validation = await validateImageUploadBuffer(
    params.buffer,
    params.filename,
    params.declaredMime,
  )
  if (!validation.ok) {
    throw new MediaUploadValidationError(validationErrorMessage(validation))
  }

  let sanitized
  try {
    sanitized = await sanitizeImageBuffer(params.buffer, validation.detectedMime)
  } catch {
    throw new MediaUploadValidationError('Could not read image file')
  }

  const objectId = randomUUID()
  const ext = validation.extension
  const quarantineKey = quarantineObjectKey(params.userId, objectId, ext)
  const hash = sha256(sanitized.buffer)
  const bucket = defaultBucket()

  const client = getS3Client()
  if (!client && process.env.MEDIA_PIPELINE_ALLOW_NO_S3 !== '1') {
    throw new MediaUploadValidationError('Upload storage is not configured')
  }

  if (client) {
    await putObject(client, {
      Bucket: bucket,
      Key: quarantineKey,
      Body: sanitized.buffer,
      ContentType: sanitized.mimeType,
    })
  }

  return {
    quarantineKey,
    sha256Hash: hash,
    mimeType: sanitized.mimeType,
    sizeBytes: sanitized.buffer.length,
    width: sanitized.width,
    height: sanitized.height,
    storageBucket: bucket,
    exifStripped: sanitized.exifStripped,
  }
}

const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm'])

/**
 * PR 3 (M5): sniff the actual container magic instead of trusting the
 * client-declared content-type. MP4/QuickTime family files carry an `ftyp`
 * box at offset 4; WebM (Matroska) files start with the EBML header.
 */
export function sniffVideoContainer(buffer: Buffer): 'video/mp4' | 'video/webm' | null {
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    return 'video/mp4'
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm'
  }
  return null
}

/** Store audio in quarantine (malware/hash scan later; no human MEDIA_REVIEW for normal clips). */
export async function processIncomingAudioUpload(params: {
  userId: string
  buffer: Buffer
  filename: string
  declaredMime?: string | null
}): Promise<ProcessedUploadResult> {
  const validation = await validateAudioUploadBuffer(
    params.buffer,
    params.filename,
    params.declaredMime,
  )
  if (!validation.ok) {
    throw new MediaUploadValidationError(audioValidationErrorMessage(validation))
  }

  const hash = sha256(params.buffer)
  const quarantineKey = quarantineObjectKey(params.userId, randomUUID(), validation.extension)
  const bucket = defaultBucket()
  const client = getS3Client()

  if (!client && process.env.MEDIA_PIPELINE_ALLOW_NO_S3 !== '1') {
    throw new MediaUploadValidationError('Upload storage is not configured')
  }

  if (client) {
    await putObject(client, {
      Bucket: bucket,
      Key: quarantineKey,
      Body: params.buffer,
      ContentType: validation.detectedMime,
    })
  }

  return {
    quarantineKey,
    sha256Hash: hash,
    mimeType: validation.detectedMime,
    sizeBytes: params.buffer.length,
    width: 0,
    height: 0,
    storageBucket: bucket,
    exifStripped: false,
  }
}

/** Store video in quarantine without transcoding (alpha). */
export async function processIncomingVideoUpload(params: {
  userId: string
  buffer: Buffer
  filename: string
  declaredMime?: string | null
}): Promise<Omit<ProcessedUploadResult, 'exifStripped' | 'width' | 'height'> & { width: number; height: number; exifStripped: false }> {
  const mime = (params.declaredMime ?? '').toLowerCase()
  if (!ALLOWED_VIDEO_MIMES.has(mime)) {
    throw new MediaUploadValidationError('Video must be MP4 or WebM')
  }
  if (params.buffer.length > MAX_VIDEO_UPLOAD_BYTES) {
    throw new MediaUploadValidationError(
      `Video file is too large (max ${uploadLimitMegabytes(MAX_VIDEO_UPLOAD_BYTES)}MB)`,
    )
  }
  // PR 3 (M5): reject payloads whose real bytes are not the declared container.
  const sniffed = sniffVideoContainer(params.buffer)
  if (sniffed === null) {
    throw new MediaUploadValidationError('File content is not a recognized MP4 or WebM video')
  }
  if (sniffed !== mime) {
    throw new MediaUploadValidationError('Video content does not match its declared type')
  }

  const hash = sha256(params.buffer)
  const ext = mime === 'video/webm' ? '.webm' : '.mp4'
  const quarantineKey = quarantineObjectKey(params.userId, randomUUID(), ext)
  const bucket = defaultBucket()
  const client = getS3Client()

  if (!client && process.env.MEDIA_PIPELINE_ALLOW_NO_S3 !== '1') {
    throw new MediaUploadValidationError('Upload storage is not configured')
  }

  if (client) {
    await putObject(client, {
      Bucket: bucket,
      Key: quarantineKey,
      Body: params.buffer,
      ContentType: mime,
    })
  }

  return {
    quarantineKey,
    sha256Hash: hash,
    mimeType: mime,
    sizeBytes: params.buffer.length,
    width: 0,
    height: 0,
    storageBucket: bucket,
    exifStripped: false,
  }
}

export function resolveMediaServingKey(asset: MediaAsset): string | null {
  if (asset.publicStorageKey && isPublicStorageState(asset.storageState)) {
    return asset.publicStorageKey
  }
  if (asset.quarantineStorageKey && !isPublicStorageState(asset.storageState)) {
    return asset.quarantineStorageKey
  }
  if (asset.storageKey.startsWith('http://') || asset.storageKey.startsWith('https://')) {
    return isPublicStorageState(asset.storageState) || isMediaPublishedStatus(asset.uploadStatus as MediaUploadStatus)
      ? asset.storageKey
      : null
  }
  return asset.storageKey
}

export function resolveMediaPublicUrl(asset: MediaAsset): string | null {
  if (!isPublicStorageState(asset.storageState) && asset.storageState !== null) {
    if (asset.storageKey.startsWith('http') && isMediaPublishedStatus(asset.uploadStatus as MediaUploadStatus)) {
      return isBrowserReachablePublicUrl(asset.storageKey) ? asset.storageKey : null
    }
    if (!asset.publicStorageKey) return null
  }
  const key = asset.publicStorageKey ?? (asset.storageKey.startsWith('http') ? null : asset.storageKey)
  if (!key || key.startsWith('http')) {
    return key?.startsWith('http') && isBrowserReachablePublicUrl(key) ? key : null
  }
  const url = publicUrlForKey(key, asset.storageBucket ?? undefined)
  return url && isBrowserReachablePublicUrl(url) ? url : null
}

export function mediaContentProxyPath(mediaAssetId: string): string {
  return `/api/v1/media/assets/${mediaAssetId}/content`
}

/** Client-facing URL: direct public object only when visibility allows anonymous access; else auth proxy. */
export function resolveMediaClientUrl(asset: MediaAsset): string {
  if (canExposePublicUrl(asset)) {
    const publicUrl = resolveMediaPublicUrl(asset)
    if (publicUrl) return publicUrl
  }
  return mediaContentProxyPath(asset.id)
}

/** Ensure a quarantine key came from this user's `/api/upload` staging path. */
export function assertQuarantineStorageKeyOwnedByUser(userId: string, storageKey: string): void {
  const expectedPrefix = `quarantine/${userId}/`
  if (!storageKey.startsWith(expectedPrefix)) {
    throw new MediaUploadValidationError('Invalid upload reference')
  }
}

/** Promote a quarantined scope-branding upload (group/org banner, logo, share) to a public URL. */
export async function promoteQuarantineToScopeBrandingUrl(params: {
  userId: string
  quarantineKey: string
  scopePath: string
  assetName: 'banner' | 'logo' | 'share' | 'hero' | 'inline' | 'cover'
}): Promise<string> {
  assertQuarantineStorageKeyOwnedByUser(params.userId, params.quarantineKey)
  const extMatch = params.quarantineKey.match(/(\.[a-z0-9]+)$/i)
  const ext = extMatch?.[1] ?? '.jpg'
  const objectId = randomUUID()
  const publicKey = `${params.scopePath}/${params.assetName}-${objectId}${ext}`
  const bucket = defaultBucket()
  const client = getS3Client()
  if (!client && process.env.MEDIA_PIPELINE_ALLOW_NO_S3 !== '1') {
    throw new MediaUploadValidationError('Upload storage is not configured')
  }
  if (client) {
    await promoteQuarantineToPublic(client, params.quarantineKey, publicKey, bucket)
  }
  const publicUrl = publicUrlForKey(publicKey, bucket)
  if (!publicUrl) {
    throw new MediaUploadValidationError('Upload succeeded but no public URL is configured')
  }
  return publicUrl
}

export type MediaScanRunResult = {
  status: ScanStatus
  scannerResults: ScannerResultRecord[]
}

export async function runMediaScan(
  asset: MediaAsset,
  scanner: MediaScannerAdapter = defaultMediaScanner,
): Promise<MediaScanRunResult> {
  await db
    .update(schema.mediaAssets)
    .set({ scanStatus: SCAN_STATUSES.running, updatedAt: new Date() })
    .where(eq(schema.mediaAssets.id, asset.id))

  const result = await scanner.scan({
    mediaAssetId: asset.id,
    sha256Hash: asset.sha256Hash,
    mimeType: asset.mimeType,
    quarantineStorageKey: asset.quarantineStorageKey,
    contentRating: asset.contentRating,
    visibility: asset.visibility,
    originalFilename: asset.originalFilename,
  })

  await db
    .update(schema.mediaAssets)
    .set({ scanStatus: result.status, updatedAt: new Date() })
    .where(eq(schema.mediaAssets.id, asset.id))

  return {
    status: result.status,
    scannerResults: result.scannerSummary ?? [],
  }
}

export async function promoteMediaAssetToPublic(params: {
  mediaAssetId: string
  promotedByUserId: string
}): Promise<MediaAsset | null> {
  const [asset] = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, params.mediaAssetId))
    .limit(1)
  if (!asset) return null

  const visibility = asset.visibility as MediaVisibility | null
  const now = new Date()

  /** Restricted visibility: scan-approved but stay in quarantine; serve only via auth proxy. */
  if (!visibilityAllowsAnonymousDirectUrl(visibility)) {
    const [updated] = await db
      .update(schema.mediaAssets)
      .set({
        storageState: MEDIA_STORAGE_STATES.validatedPrivate,
        promotedAt: now,
        promotedByUserId: params.promotedByUserId,
        updatedAt: now,
      })
      .where(eq(schema.mediaAssets.id, params.mediaAssetId))
      .returning()
    if (updated) await syncProfilePhotoServingUrlsForAsset(params.mediaAssetId, updated)
    return updated ?? null
  }

  const quarantineKey = asset.quarantineStorageKey ?? asset.storageKey
  if (!quarantineKey || quarantineKey.startsWith('http')) {
    const [updated] = await db
      .update(schema.mediaAssets)
      .set({
        storageState: MEDIA_STORAGE_STATES.approvedPublic,
        promotedAt: now,
        promotedByUserId: params.promotedByUserId,
        updatedAt: now,
      })
      .where(eq(schema.mediaAssets.id, params.mediaAssetId))
      .returning()
    return updated ?? null
  }

  const ext = extensionFromMime(asset.mimeType as AllowedImageMime)
  const publicKey = publicMediaObjectKey(asset.uploaderUserId, asset.id, ext)
  const bucket = asset.storageBucket ?? defaultBucket()
  const client = getS3Client()

  if (client) {
    await promoteQuarantineToPublic(client, quarantineKey, publicKey, bucket)
  }

  const [updated] = await db
    .update(schema.mediaAssets)
    .set({
      publicStorageKey: publicKey,
      storageKey: publicKey,
      storageState: MEDIA_STORAGE_STATES.approvedPublic,
      promotedAt: now,
      promotedByUserId: params.promotedByUserId,
      updatedAt: now,
    })
    .where(eq(schema.mediaAssets.id, params.mediaAssetId))
    .returning()

  if (updated) await syncProfilePhotoServingUrlsForAsset(params.mediaAssetId, updated)

  return updated ?? null
}

export type FinalizeAfterAttestationResult = {
  uploadStatus: MediaUploadStatus
  scanStatus: ScanStatus
  storageState: string
  promoted: boolean
  scannerResults: ScannerResultRecord[]
  finalizeBranch:
    | 'lane_red_rejected'
    | 'scan_error_pending'
    | 'scan_flagged_quarantined'
    | 'green_auto_promoted'
    | 'yellow_or_other_quarantined'
}

/** Run scan + promotion after T&S-2 attestation lane decision. */
export async function finalizeMediaAfterAttestation(params: {
  mediaAssetId: string
  userId: string
  lane: MediaPublishLane
  uploadStatus: MediaUploadStatus
}): Promise<FinalizeAfterAttestationResult> {
  const [asset] = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, params.mediaAssetId))
    .limit(1)
  if (!asset) {
    throw new Error('Media asset not found')
  }

  let uploadStatus = params.uploadStatus
  let storageState = asset.storageState

  if (params.lane === 'RED') {
    await db
      .update(schema.mediaAssets)
      .set({
        storageState: MEDIA_STORAGE_STATES.rejectedPrivate,
        scanStatus: SCAN_STATUSES.failed,
        updatedAt: new Date(),
      })
      .where(eq(schema.mediaAssets.id, params.mediaAssetId))
    return {
      uploadStatus,
      scanStatus: SCAN_STATUSES.failed,
      storageState: MEDIA_STORAGE_STATES.rejectedPrivate,
      promoted: false,
      scannerResults: [],
      finalizeBranch: 'lane_red_rejected',
    }
  }

  const scanRun = await runMediaScan(asset)
  const scanStatus = scanRun.status

  if (scanStatus === SCAN_STATUSES.error) {
    uploadStatus = MEDIA_UPLOAD_STATUSES.pendingScan
    await db
      .update(schema.mediaAssets)
      .set({
        uploadStatus,
        storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
        updatedAt: new Date(),
      })
      .where(eq(schema.mediaAssets.id, params.mediaAssetId))
    return {
      uploadStatus,
      scanStatus,
      storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
      promoted: false,
      scannerResults: scanRun.scannerResults,
      finalizeBranch: 'scan_error_pending',
    }
  }

  if (scanStatus === SCAN_STATUSES.flagged || scanStatus === SCAN_STATUSES.failed) {
    uploadStatus = MEDIA_UPLOAD_STATUSES.quarantined
    storageState = MEDIA_STORAGE_STATES.quarantinedPrivate
    await db
      .update(schema.mediaAssets)
      .set({
        uploadStatus,
        storageState,
        updatedAt: new Date(),
      })
      .where(eq(schema.mediaAssets.id, params.mediaAssetId))
    return {
      uploadStatus,
      scanStatus,
      storageState,
      promoted: false,
      scannerResults: scanRun.scannerResults,
      finalizeBranch: 'scan_flagged_quarantined',
    }
  }

  if (
    params.lane === 'GREEN' &&
    uploadStatus === MEDIA_UPLOAD_STATUSES.autoApproved &&
    scanStatus === SCAN_STATUSES.passed
  ) {
    const promoted = await promoteMediaAssetToPublic({
      mediaAssetId: params.mediaAssetId,
      promotedByUserId: params.userId,
    })
    await db
      .update(schema.mediaAssets)
      .set({
        uploadStatus,
        scanStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.mediaAssets.id, params.mediaAssetId))
    return {
      uploadStatus,
      scanStatus,
      storageState: promoted?.storageState ?? MEDIA_STORAGE_STATES.approvedPublic,
      promoted: Boolean(promoted),
      scannerResults: scanRun.scannerResults,
      finalizeBranch: 'green_auto_promoted',
    }
  }

  storageState = MEDIA_STORAGE_STATES.quarantinedPrivate
  await db
    .update(schema.mediaAssets)
    .set({
      storageState,
      updatedAt: new Date(),
    })
    .where(eq(schema.mediaAssets.id, params.mediaAssetId))

  return {
    uploadStatus,
    scanStatus,
    storageState,
    promoted: false,
    scannerResults: scanRun.scannerResults,
    finalizeBranch: 'yellow_or_other_quarantined',
  }
}

export function canExposePublicUrl(asset: MediaAsset): boolean {
  if (!isPublicStorageState(asset.storageState) || !resolveMediaPublicUrl(asset)) return false
  const visibility = asset.visibility as MediaVisibility | null
  if (!visibilityAllowsAnonymousDirectUrl(visibility)) return false
  const rating = asset.contentRating as MediaContentRating | null
  if (rating && visibility && !explicitMediaAllowsPublicUrl(rating, visibility)) {
    return false
  }
  return true
}
