import { useCallback, useState } from 'react'
import type { BrandingAssetKind } from '@/components/organizer/ScopeBrandingPanel'
import { uploadGroupBrandingAsset } from '@/lib/group-branding-upload'

export type GroupBrandingState = {
  bannerUrl: string | null
  logoUrl: string | null
  shareImageUrl: string | null
}

export function useGroupBrandingSettings(groupId: string, reload: () => Promise<void>) {
  const [msg, setMsg] = useState<string | null>(null)
  const [uploading, setUploading] = useState<BrandingAssetKind | null>(null)

  const patchBranding = useCallback(
    async (body: Partial<GroupBrandingState>) => {
      setMsg(null)
      try {
        const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        if (!r.ok) {
          setMsg(j.error ?? 'Could not save')
          return false
        }
        await reload()
        return true
      } catch {
        setMsg('Network error')
        return false
      }
    },
    [groupId, reload],
  )

  const uploadAsset = useCallback(
    async (kind: BrandingAssetKind) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/png,image/jpeg,image/webp'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        setUploading(kind)
        setMsg(null)
        try {
          await uploadGroupBrandingAsset(groupId, kind, file)
          await reload()
          setMsg(`${kind === 'share' ? 'Link preview' : kind} updated.`)
        } catch (err) {
          setMsg(err instanceof Error ? err.message : 'Upload failed')
        } finally {
          setUploading(null)
        }
      }
      input.click()
    },
    [groupId, reload],
  )

  const clearAsset = useCallback(
    async (kind: BrandingAssetKind) => {
      const field =
        kind === 'banner' ? 'bannerUrl'
        : kind === 'logo' ? 'logoUrl'
        : 'shareImageUrl'
      const ok = await patchBranding({ [field]: null })
      if (ok) setMsg(`${kind === 'share' ? 'Link preview' : kind} removed.`)
    },
    [patchBranding],
  )

  return { msg, setMsg, uploading, uploadAsset, clearAsset }
}
