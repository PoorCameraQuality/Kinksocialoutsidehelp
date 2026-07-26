import { useCallback, useState } from 'react'
import type { OrgFlags } from '@/components/org/OrgAdminDashboard'
import type { BrandingAssetKind } from '@/components/organizer/ScopeBrandingPanel'
import { uploadOrgBrandingAsset } from '@/lib/org-branding-upload'

export type OrgAdminSettingsOrg = {
  displayName: string
  slug: string
  visibility: string
  logoUrl: string | null
  bannerUrl: string | null
  shareImageUrl?: string | null
  featureFlags: OrgFlags
  externalSiteUrl: string | null
  showExternalEmbed: boolean
  galleryPublic?: boolean
}

export function useOrgAdminSettings(orgKey: string, reloadOrg: () => Promise<void>) {
  const [adminMsg, setAdminMsg] = useState<string | null>(null)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [shareUploading, setShareUploading] = useState(false)

  const patchFlags = useCallback(
    async (org: OrgAdminSettingsOrg | null, next: Partial<OrgFlags>) => {
      if (!org) return
      setAdminMsg(null)
      try {
        const r = await fetch(`/api/v1/organizations/${orgKey}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featureFlags: { ...org.featureFlags, ...next } }),
        })
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        if (!r.ok) {
          setAdminMsg(j.error ?? 'Update failed')
          return
        }
        await reloadOrg()
        setAdminMsg('Saved.')
      } catch {
        setAdminMsg('Network error')
      }
    },
    [orgKey, reloadOrg],
  )

  const patchOrganization = useCallback(
    async (body: Record<string, unknown>, successMessage?: string) => {
      setAdminMsg(null)
      try {
        const r = await fetch(`/api/v1/organizations/${orgKey}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        if (!r.ok) {
          setAdminMsg(j.error ?? 'Update failed')
          return false
        }
        await reloadOrg()
        if (successMessage) setAdminMsg(successMessage)
        return true
      } catch {
        setAdminMsg('Network error')
        return false
      }
    },
    [orgKey, reloadOrg],
  )

  const patchGalleryPublic = useCallback(
    async (next: boolean) => {
      setAdminMsg(null)
      try {
        const r = await fetch(`/api/v1/organizations/${orgKey}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ galleryPublic: next }),
        })
        if (!r.ok) {
          setAdminMsg('Could not update gallery visibility')
          return
        }
        await reloadOrg()
      } catch {
        setAdminMsg('Network error')
      }
    },
    [orgKey, reloadOrg],
  )

  const pickAndUploadBranding = useCallback(
    (
      isAdmin: boolean,
      kind: BrandingAssetKind,
      setUploading: (value: boolean) => void,
      successMessage: string,
      failureMessage: string,
      accept: string,
    ) => {
      if (!isAdmin) return
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        setUploading(true)
        setAdminMsg(null)
        try {
          await uploadOrgBrandingAsset(orgKey, kind, file)
          await reloadOrg()
          setAdminMsg(successMessage)
        } catch (err) {
          setAdminMsg(err instanceof Error ? err.message : failureMessage)
        } finally {
          setUploading(false)
        }
      }
      input.click()
    },
    [orgKey, reloadOrg],
  )

  const uploadOrgBanner = useCallback(
    (isAdmin: boolean) => {
      pickAndUploadBranding(
        isAdmin,
        'banner',
        setBannerUploading,
        'Banner updated.',
        'Banner upload failed',
        'image/*',
      )
    },
    [pickAndUploadBranding],
  )

  const clearOrgBanner = useCallback(
    async (isAdmin: boolean) => {
      if (!isAdmin) return
      setAdminMsg(null)
      try {
        const r = await fetch(`/api/v1/organizations/${orgKey}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bannerUrl: null }),
        })
        if (!r.ok) {
          setAdminMsg('Could not remove banner')
          return
        }
        await reloadOrg()
        setAdminMsg('Banner removed.')
      } catch {
        setAdminMsg('Network error')
      }
    },
    [orgKey, reloadOrg],
  )

  const uploadOrgLogo = useCallback(
    (isAdmin: boolean) => {
      pickAndUploadBranding(
        isAdmin,
        'logo',
        setLogoUploading,
        'Logo updated.',
        'Logo upload failed',
        'image/*',
      )
    },
    [pickAndUploadBranding],
  )

  const clearOrgLogo = useCallback(
    async (isAdmin: boolean) => {
      if (!isAdmin) return
      setAdminMsg(null)
      try {
        const r = await fetch(`/api/v1/organizations/${orgKey}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logoUrl: null }),
        })
        if (!r.ok) {
          setAdminMsg('Could not remove logo')
          return
        }
        await reloadOrg()
        setAdminMsg('Logo removed.')
      } catch {
        setAdminMsg('Network error')
      }
    },
    [orgKey, reloadOrg],
  )

  const uploadOrgShareImage = useCallback(
    (isAdmin: boolean) => {
      pickAndUploadBranding(
        isAdmin,
        'share',
        setShareUploading,
        'Link preview image updated.',
        'Share image upload failed',
        'image/png,image/jpeg,image/webp',
      )
    },
    [pickAndUploadBranding],
  )

  const clearOrgShareImage = useCallback(
    async (isAdmin: boolean) => {
      if (!isAdmin) return
      await patchOrganization({ shareImageUrl: null }, 'Link preview image removed.')
    },
    [patchOrganization],
  )

  return {
    adminMsg,
    setAdminMsg,
    bannerUploading,
    logoUploading,
    shareUploading,
    patchFlags,
    patchOrganization,
    patchGalleryPublic,
    uploadOrgBanner,
    clearOrgBanner,
    uploadOrgLogo,
    clearOrgLogo,
    uploadOrgShareImage,
    clearOrgShareImage,
  }
}
