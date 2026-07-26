import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SettingsBrandingTab from '@/components/organizer/settings/SettingsBrandingTab'
import SettingsContentTab from '@/components/organizer/settings/SettingsContentTab'
import SettingsFeaturesTab from '@/components/organizer/settings/SettingsFeaturesTab'
import SettingsGeneralTab from '@/components/organizer/settings/SettingsGeneralTab'
import SettingsPublishTab from '@/components/organizer/settings/SettingsPublishTab'
import {
  SettingsHelpStrip,
  SettingsPageHeader,
  SettingsSectionTabs,
  SettingsStatusMessage,
} from '@/components/organizer/settings/settings-ui'
import type { OrgFlags } from '@/components/org/OrgAdminDashboard'
import { useOrgAdminSettings } from '@/hooks/useOrgAdminSettings'
import { parseSettingsSection, type SettingsSection } from '@/lib/organizer/org-settings-utils'

type OrgDetail = {
  id: string
  slug: string
  displayName: string
  visibility: string
  logoUrl: string | null
  bannerUrl: string | null
  shareImageUrl?: string | null
  bio?: string | null
  featureFlags: OrgFlags
  externalSiteUrl: string | null
  showExternalEmbed: boolean
  galleryPublic?: boolean
  viewerRole: string | null
  community?: {
    welcomeHtml?: string | null
    faq?: { q: string; a: string }[]
    communityModules?: { type?: string }[]
  } | null
}

type Props = {
  orgSlug: string
  displayName: string
  onOrgUpdated?: (org: OrgDetail) => void
}

export default function OrganizerOrgSettingsPanel({ orgSlug, displayName, onOrgUpdated }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = parseSettingsSection(searchParams.get('settingsSection'))
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempted, setLoadAttempted] = useState(false)

  const onOrgUpdatedRef = useRef(onOrgUpdated)
  onOrgUpdatedRef.current = onOrgUpdated

  const reloadOrg = useCallback(async () => {
    const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
    if (!r.ok) throw new Error('reload failed')
    const j = (await r.json()) as { organization: OrgDetail }
    setOrg(j.organization)
    onOrgUpdatedRef.current?.(j.organization)
  }, [orgSlug])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        await reloadOrg()
      } catch {
        if (!cancelled) setLoadError('Could not load organization settings.')
      } finally {
        if (!cancelled) setLoadAttempted(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgSlug, reloadOrg])

  const {
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
  } = useOrgAdminSettings(orgSlug, reloadOrg)

  useEffect(() => {
    if (!adminMsg || /fail|error|could not|network/i.test(adminMsg)) return
    const timer = window.setTimeout(() => setAdminMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [adminMsg, setAdminMsg])

  const hub = `/orgs/${encodeURIComponent(orgSlug)}`
  const publicHubHref = `${hub}?tab=Overview`
  const aboutHref = `${hub}?tab=About`
  const scheduleHref = `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=schedule`
  const settingsBase = `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=settings`

  const setSection = useCallback(
    (section: SettingsSection) => {
      const next = new URLSearchParams(searchParams)
      if (section === 'general') next.delete('settingsSection')
      else next.set('settingsSection', section)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const publishChecks = useMemo(() => {
    if (!org) return []
    const welcome = Boolean(org.community?.welcomeHtml?.trim())
    const faq = (org.community?.faq?.length ?? 0) > 0
    const hasBranding = Boolean(org.logoUrl || org.bannerUrl)
    return [
      { label: 'Name is clear', done: Boolean(org.displayName.trim()) },
      { label: 'Bio or welcome message exists', done: welcome || Boolean(org.bio?.trim()) },
      { label: 'Logo or banner added', done: hasBranding },
      { label: 'Visibility is intentional', done: Boolean(org.visibility) },
      { label: 'Public hub content reviewed', done: welcome || faq },
      { label: 'Events or calendar enabled if relevant', done: org.featureFlags.calendarEnabled },
    ]
  }, [org])

  if (loadError) {
    return (
      <div className="max-w-5xl">
        <div
          className="rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoadError(null)
                void reloadOrg().catch(() => setLoadError('Could not load organization settings.'))
              }}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!org) {
    if (loadAttempted && !loadError) {
      return (
        <div className="max-w-5xl rounded-xl border border-dc-border bg-dc-elevated/80 px-4 py-3 text-sm text-dc-muted">
          <p>Organization settings unavailable.</p>
          <button
            type="button"
            onClick={() => void reloadOrg().catch(() => setLoadError('Could not load organization settings.'))}
            className="mt-2 min-h-10 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            Retry
          </button>
        </div>
      )
    }
    return <div className="h-48 max-w-5xl animate-pulse rounded-2xl bg-dc-elevated-muted" aria-busy="true" />
  }

  const adminMsgIsSuccess = Boolean(adminMsg && !/fail|error|could not|network/i.test(adminMsg))
  const isAdmin = org.viewerRole === 'ADMIN' || org.viewerRole === 'OWNER'
  const hasFaq = (org.community?.faq?.length ?? 0) > 0
  const hasDocumentsModule = (org.community?.communityModules ?? []).some((m) => m.type === 'documents')

  const uploading =
    bannerUploading ? 'banner'
    : logoUploading ? 'logo'
    : shareUploading ? 'share'
    : null

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SettingsPageHeader />
      <SettingsSectionTabs active={activeSection} onChange={setSection} />

      {adminMsg ?
        <SettingsStatusMessage
          message={adminMsg}
          isSuccess={adminMsgIsSuccess}
          onDismiss={adminMsgIsSuccess ? undefined : () => setAdminMsg(null)}
        />
      : null}

      {activeSection === 'general' ?
        <SettingsGeneralTab
          org={org}
          publicHubHref={publicHubHref}
          aboutHref={aboutHref}
          onPatch={patchOrganization}
        />
      : null}

      {activeSection === 'branding' ?
        <SettingsBrandingTab
          org={org}
          publicHubHref={publicHubHref}
          aboutHref={aboutHref}
          uploading={uploading}
          onUpload={(kind) => {
            if (kind === 'banner') void uploadOrgBanner(isAdmin)
            else if (kind === 'logo') void uploadOrgLogo(isAdmin)
            else void uploadOrgShareImage(isAdmin)
          }}
          onClear={(kind) => {
            if (kind === 'banner') void clearOrgBanner(isAdmin)
            else if (kind === 'logo') void clearOrgLogo(isAdmin)
            else void clearOrgShareImage(isAdmin)
          }}
        />
      : null}

      {activeSection === 'features' ?
        <SettingsFeaturesTab
          flags={org.featureFlags}
          hasFaq={hasFaq}
          hasDocumentsModule={hasDocumentsModule}
          onPatchFlags={(next) => void patchFlags(org, next)}
        />
      : null}

      {activeSection === 'content' ?
        <SettingsContentTab
          orgSlug={orgSlug}
          publicHubHref={publicHubHref}
          scheduleHref={scheduleHref}
          galleryPublic={org.galleryPublic ?? false}
          onGalleryPublicChange={(next) => void patchGalleryPublic(next)}
        />
      : null}

      {activeSection === 'publish' ?
        <SettingsPublishTab
          orgSlug={orgSlug}
          displayName={displayName}
          settingsBase={settingsBase}
          checks={publishChecks}
        />
      : null}

      <SettingsHelpStrip orgSlug={orgSlug} />
    </div>
  )
}
