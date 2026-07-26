import { uploadMediaFile } from '@/lib/upload-media'

export type EducationImageVariant = 'hero' | 'inline'

const UPLOAD_PURPOSE: Record<EducationImageVariant, string> = {
  hero: 'education_hero',
  inline: 'education_inline',
}

/** Upload and promote an education article image; returns a public URL for hero or inline body use. */
export async function uploadEducationImage(file: File, variant: EducationImageVariant): Promise<string> {
  const uploaded = await uploadMediaFile(file, UPLOAD_PURPOSE[variant])
  if (uploaded.status === 'url' && uploaded.url) return uploaded.url
  if (!uploaded.quarantineKey) {
    throw new Error('Upload did not return a quarantine key.')
  }
  const r = await fetch('/api/v1/me/education-articles/image/attach', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quarantineKey: uploaded.quarantineKey, variant }),
  })
  const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!r.ok || !data.url) {
    throw new Error(data.error ?? 'Could not attach education image')
  }
  return data.url
}
