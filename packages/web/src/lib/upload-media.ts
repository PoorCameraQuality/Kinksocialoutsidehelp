export type UploadMediaResult = {
  /** File received and staged for scan — not a moderation hold. */
  status: 'staged' | 'url'
  quarantineKey?: string
  url?: string
  sha256?: string
  mimeType?: string
  sizeBytes?: number
  width?: number
  height?: number
}

export function isStagedUploadResult(status: string | undefined): boolean {
  return status === 'staged' || status === 'quarantined'
}

/** Upload a single image via `POST /api/upload` with explicit purpose. */
export async function uploadMediaFile(
  file: File,
  purpose: string,
): Promise<UploadMediaResult> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('purpose', purpose)
  const r = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd })
  const data = (await r.json().catch(() => ({}))) as {
    url?: string | null
    quarantineKey?: string
    key?: string
    sha256?: string
    mimeType?: string
    sizeBytes?: number
    width?: number
    height?: number
    status?: string
    code?: string
    error?: string
  }
  if (r.status === 403 && data.code === 'alpha_upload_disabled') {
    throw new Error(data.error ?? 'This upload type is disabled for the beta test server.')
  }
  if (!r.ok) {
    if (r.status === 401) throw new Error('Log in to upload images.')
    if (r.status === 503) throw new Error(data.error ?? 'Image upload is not available in this environment.')
    throw new Error(data.error ?? 'Upload failed')
  }
  if (data.url) {
    return { status: 'url', url: data.url, quarantineKey: data.quarantineKey ?? data.key }
  }
  const quarantineKey = data.quarantineKey ?? data.key
  if (!quarantineKey) {
    throw new Error('Upload did not return a quarantine key.')
  }
  return {
    status: 'staged',
    quarantineKey,
    sha256: data.sha256,
    mimeType: data.mimeType,
    sizeBytes: data.sizeBytes,
    width: data.width,
    height: data.height,
  }
}

/** @deprecated Alpha disables most direct URL uploads - prefer profile photo pipeline. */
export async function uploadMediaFileLegacyUrl(file: File, purpose: string): Promise<string> {
  const result = await uploadMediaFile(file, purpose)
  if (result.status === 'url' && result.url) return result.url
  throw new Error('This upload surface requires the media attestation pipeline during beta.')
}
