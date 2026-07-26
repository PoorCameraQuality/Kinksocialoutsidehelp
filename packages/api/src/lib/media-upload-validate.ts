import { fileTypeFromBuffer } from 'file-type'
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  uploadLimitMegabytes,
} from '@c2k/shared'

export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number]

export const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-wav',
] as const

export type AllowedAudioMime = (typeof ALLOWED_AUDIO_MIMES)[number]

export { MAX_IMAGE_UPLOAD_BYTES, MAX_AUDIO_UPLOAD_BYTES }

export type MediaUploadValidationResult =
  | {
      ok: true
      detectedMime: AllowedImageMime
      extension: string
    }
  | {
      ok: false
      reason:
        | 'empty_file'
        | 'file_too_large'
        | 'unsupported_type'
        | 'mime_mismatch'
        | 'suspicious_extension'
        | 'malformed_image'
    }

const ALLOWED_SET = new Set<string>(ALLOWED_IMAGE_MIMES)

const MIME_TO_EXT: Record<AllowedImageMime, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

function normalizeExtension(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.jpeg')) return '.jpg'
  const dot = lower.lastIndexOf('.')
  if (dot === -1) return ''
  return lower.slice(dot)
}

function extensionMatchesMime(ext: string, mime: AllowedImageMime): boolean {
  const expected = MIME_TO_EXT[mime]
  if (ext === expected) return true
  if (mime === 'image/jpeg' && (ext === '.jpg' || ext === '.jpeg')) return true
  return false
}

/** Centralized image upload validation (magic bytes + size + extension sanity). */
export async function validateImageUploadBuffer(
  buffer: Buffer,
  filename: string,
  declaredMime?: string | null,
): Promise<MediaUploadValidationResult> {
  if (!buffer.length) {
    return { ok: false, reason: 'empty_file' }
  }
  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
    return { ok: false, reason: 'file_too_large' }
  }

  const ext = normalizeExtension(filename)
  if (ext.includes('..') || filename.includes('\0')) {
    return { ok: false, reason: 'suspicious_extension' }
  }

  const detected = await fileTypeFromBuffer(buffer)
  if (!detected || !ALLOWED_SET.has(detected.mime)) {
    return { ok: false, reason: 'unsupported_type' }
  }

  const detectedMime = detected.mime as AllowedImageMime

  if (declaredMime && declaredMime !== 'application/octet-stream' && declaredMime !== detectedMime) {
    return { ok: false, reason: 'mime_mismatch' }
  }

  if (ext && !extensionMatchesMime(ext, detectedMime)) {
    return { ok: false, reason: 'mime_mismatch' }
  }

  return {
    ok: true,
    detectedMime,
    extension: MIME_TO_EXT[detectedMime],
  }
}

export function validationErrorMessage(reason: MediaUploadValidationResult & { ok: false }): string {
  switch (reason.reason) {
    case 'empty_file':
      return 'Upload is empty'
    case 'file_too_large':
      return `File exceeds the maximum upload size (${uploadLimitMegabytes(MAX_IMAGE_UPLOAD_BYTES)} MB)`
    case 'unsupported_type':
      return 'Unsupported image type. Use JPEG, PNG, WebP, or GIF'
    case 'mime_mismatch':
      return 'File type does not match the file extension'
    case 'suspicious_extension':
      return 'Invalid filename'
    case 'malformed_image':
      return 'Could not read image file'
    default:
      return 'Invalid upload'
  }
}

export type AudioUploadValidationResult =
  | {
      ok: true
      detectedMime: AllowedAudioMime
      extension: string
    }
  | {
      ok: false
      reason: 'empty_file' | 'file_too_large' | 'unsupported_type' | 'mime_mismatch' | 'suspicious_extension'
    }

const AUDIO_ALLOWED_SET = new Set<string>([
  ...ALLOWED_AUDIO_MIMES,
  // file-type sometimes reports WAV as audio/vnd.wave
  'audio/vnd.wave',
])

const AUDIO_MIME_TO_EXT: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/vnd.wave': '.wav',
  'audio/webm': '.webm',
}

const AUDIO_EXT_TO_MIME: Record<string, AllowedAudioMime> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
}

/** Sniff common audio containers when file-type is inconclusive. */
export function sniffAudioContainer(buffer: Buffer): AllowedAudioMime | null {
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString('latin1') === 'ID3') {
    return 'audio/mpeg'
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) {
    return 'audio/mpeg'
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('latin1') === 'OggS') {
    return 'audio/ogg'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WAVE'
  ) {
    return 'audio/wav'
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('latin1')
    if (['M4A ', 'mp42', 'isom', 'M4B ', 'mp41'].includes(brand)) {
      return 'audio/mp4'
    }
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'audio/webm'
  }
  return null
}

function normalizeAudioMime(mime: string): AllowedAudioMime | null {
  if (mime === 'audio/x-wav' || mime === 'audio/vnd.wave') return 'audio/wav'
  if ((ALLOWED_AUDIO_MIMES as readonly string[]).includes(mime)) return mime as AllowedAudioMime
  return null
}

/** Validate feed audio uploads (magic bytes + size + extension sanity). */
export async function validateAudioUploadBuffer(
  buffer: Buffer,
  filename: string,
  declaredMime?: string | null,
): Promise<AudioUploadValidationResult> {
  if (!buffer.length) {
    return { ok: false, reason: 'empty_file' }
  }
  if (buffer.length > MAX_AUDIO_UPLOAD_BYTES) {
    return { ok: false, reason: 'file_too_large' }
  }

  const ext = normalizeExtension(filename)
  if (ext.includes('..') || filename.includes('\0')) {
    return { ok: false, reason: 'suspicious_extension' }
  }

  const detected = await fileTypeFromBuffer(buffer)
  let rawMime: string | null =
    detected?.mime && AUDIO_ALLOWED_SET.has(detected.mime) ? detected.mime : null
  if (!rawMime) {
    rawMime = sniffAudioContainer(buffer)
  }
  const detectedMime = rawMime ? normalizeAudioMime(rawMime) : null
  if (!detectedMime) {
    return { ok: false, reason: 'unsupported_type' }
  }

  const declared = (declaredMime ?? '').toLowerCase()
  if (
    declared &&
    declared !== 'application/octet-stream' &&
    declared !== 'audio/*' &&
    normalizeAudioMime(declared) !== detectedMime &&
    // browsers often send audio/x-m4a for m4a
    !(detectedMime === 'audio/mp4' && (declared === 'audio/x-m4a' || declared === 'audio/aac'))
  ) {
    return { ok: false, reason: 'mime_mismatch' }
  }

  if (ext && AUDIO_EXT_TO_MIME[ext] && AUDIO_EXT_TO_MIME[ext] !== detectedMime) {
    return { ok: false, reason: 'mime_mismatch' }
  }

  return {
    ok: true,
    detectedMime,
    extension: AUDIO_MIME_TO_EXT[detectedMime] ?? '.bin',
  }
}

export function audioValidationErrorMessage(reason: AudioUploadValidationResult & { ok: false }): string {
  switch (reason.reason) {
    case 'empty_file':
      return 'Upload is empty'
    case 'file_too_large':
      return `Audio file exceeds the maximum upload size (${uploadLimitMegabytes(MAX_AUDIO_UPLOAD_BYTES)} MB)`
    case 'unsupported_type':
      return 'Unsupported audio type. Use MP3, M4A, OGG, WAV, or WebM audio'
    case 'mime_mismatch':
      return 'Audio file type does not match the file extension'
    case 'suspicious_extension':
      return 'Invalid filename'
    default:
      return 'Invalid audio upload'
  }
}
