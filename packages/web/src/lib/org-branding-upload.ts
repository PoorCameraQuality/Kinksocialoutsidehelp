import type { BrandingAssetKind } from '@/components/organizer/ScopeBrandingPanel'
import { uploadMediaFile } from '@/lib/upload-media'

const BRANDING_PURPOSE: Record<BrandingAssetKind, string> = {
  banner: 'org_banner',
  logo: 'org_logo',
  share: 'org_share',
}

/** Upload an org branding image and attach it to the organization record. Returns the public URL. */
export async function uploadOrgBrandingAsset(
  orgKey: string,
  kind: BrandingAssetKind,
  file: File,
): Promise<string> {
  const uploaded = await uploadMediaFile(file, BRANDING_PURPOSE[kind])
  if (uploaded.status === 'url' && uploaded.url) {
    const field =
      kind === 'banner' ? 'bannerUrl'
      : kind === 'logo' ? 'logoUrl'
      : 'shareImageUrl'
    const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgKey)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: uploaded.url }),
    })
    const j = (await r.json().catch(() => ({}))) as { error?: string }
    if (!r.ok) throw new Error(j.error ?? 'Could not save branding image')
    return uploaded.url
  }
  if (!uploaded.quarantineKey) {
    throw new Error('Upload did not return a quarantine key.')
  }
  const attach = await fetch(
    `/api/v1/organizations/${encodeURIComponent(orgKey)}/branding/attach`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, quarantineKey: uploaded.quarantineKey }),
    },
  )
  const data = (await attach.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!attach.ok || !data.url) {
    throw new Error(data.error ?? 'Could not attach branding image')
  }
  return data.url
}
