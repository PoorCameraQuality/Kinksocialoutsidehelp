import { uploadMediaFile } from '@/lib/upload-media'

export type IsoImageUploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string; code?: string }

/** Stage via /api/upload, then promote to a public ISO image URL. */
export async function uploadIsoImage(file: File): Promise<IsoImageUploadResult> {
  let uploaded: Awaited<ReturnType<typeof uploadMediaFile>>
  try {
    uploaded = await uploadMediaFile(file, 'profile_media')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Upload failed' }
  }

  if (uploaded.status === 'url' && uploaded.url) {
    return { ok: true, url: uploaded.url }
  }

  if (!uploaded.quarantineKey) {
    return { ok: false, error: 'Upload did not return a quarantine key.' }
  }

  const r = await fetch('/api/v1/me/iso/images', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quarantineKey: uploaded.quarantineKey }),
  })
  const data = (await r.json().catch(() => ({}))) as {
    url?: string
    error?: string
    code?: string
  }
  if (!r.ok || typeof data.url !== 'string') {
    return {
      ok: false,
      error: typeof data.error === 'string' ? data.error : 'Could not finalize ISO image.',
      code: data.code,
    }
  }
  return { ok: true, url: data.url }
}
