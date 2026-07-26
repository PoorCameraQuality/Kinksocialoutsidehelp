import type { FeedAttachment } from '@c2k/shared'
import { uploadMediaFile } from '@/lib/upload-media'

export type FeedComposerImageUploadResult =
  | {
      ok: true
      attachment: FeedAttachment
      pendingReview?: boolean
      message?: string
    }
  | { ok: false; error: string; code?: string }

/** Upload a feed composer image through quarantine, scan, and media attachment prep. */
export async function uploadFeedComposerImage(
  file: File,
  opts?: { signal?: AbortSignal },
): Promise<FeedComposerImageUploadResult> {
  const uploaded = await uploadMediaFile(file, 'feed_image')
  const quarantineKey = uploaded.quarantineKey
  if (!quarantineKey) {
    return { ok: false, error: 'Upload did not return a quarantine key.' }
  }

  const r = await fetch('/api/v1/feed/composer/image', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: opts?.signal,
    body: JSON.stringify({
      quarantineKey,
      sha256Hash: uploaded.sha256,
      mimeType: uploaded.mimeType ?? file.type ?? 'image/jpeg',
      sizeBytes: uploaded.sizeBytes ?? file.size,
      originalFilename: file.name,
      imageWidth: uploaded.width,
      imageHeight: uploaded.height,
    }),
  })

  const data = (await r.json().catch(() => ({}))) as {
    error?: string
    code?: string
    attachment?: FeedAttachment
    pendingReview?: boolean
    message?: string
  }

  if (!r.ok) {
    return {
      ok: false,
      error: typeof data.error === 'string' ? data.error : 'Could not prepare feed photo.',
      code: data.code,
    }
  }

  if (!data.attachment || data.attachment.type !== 'media') {
    return { ok: false, error: 'Feed photo response was invalid.' }
  }

  return {
    ok: true,
    attachment: data.attachment,
    pendingReview: data.pendingReview,
    message: data.message,
  }
}
