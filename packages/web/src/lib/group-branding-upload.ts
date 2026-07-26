import type { BrandingAssetKind } from '@/components/organizer/ScopeBrandingPanel'
import { uploadMediaFile } from '@/lib/upload-media'

const BRANDING_FIELD: Record<BrandingAssetKind, 'bannerUrl' | 'logoUrl' | 'shareImageUrl'> = {
  banner: 'bannerUrl',
  logo: 'logoUrl',
  share: 'shareImageUrl',
}

/** Upload a group branding image and attach it to the group record. Returns the public URL. */
export async function uploadGroupBrandingAsset(
  groupId: string,
  kind: BrandingAssetKind,
  file: File,
): Promise<string> {
  const uploaded = await uploadMediaFile(file, 'group_branding')
  if (uploaded.status === 'url' && uploaded.url) {
    const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [BRANDING_FIELD[kind]]: uploaded.url }),
    })
    const j = (await r.json().catch(() => ({}))) as { error?: string }
    if (!r.ok) throw new Error(j.error ?? 'Could not save branding image')
    return uploaded.url
  }
  if (!uploaded.quarantineKey) {
    throw new Error('Upload did not return a quarantine key.')
  }
  const attach = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/branding/attach`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, quarantineKey: uploaded.quarantineKey }),
  })
  const data = (await attach.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!attach.ok || !data.url) {
    throw new Error(data.error ?? 'Could not attach branding image')
  }
  return data.url
}
