import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OrgBioEditorPanel from '@/components/organizer/admin/OrgBioEditorPanel'
import OrgContentEditorPanel, { type OrgCommunityDraft } from '@/components/organizer/admin/OrgContentEditorPanel'
import OrgGalleryAdminPanel from '@/components/organizer/admin/OrgGalleryAdminPanel'
import OrgEmailListPanel from '@/components/organizer/admin/OrgEmailListPanel'
import {
  OverviewContentPreviewCard,
  SettingsSection,
  SettingsSubsectionHeader,
} from '@/components/organizer/settings/settings-ui'

type Props = {
  orgSlug: string
  publicHubHref: string
  scheduleHref: string
  galleryPublic: boolean
  onGalleryPublicChange: (next: boolean) => void
}

export default function SettingsContentTab({
  orgSlug,
  publicHubHref,
  scheduleHref,
  galleryPublic,
  onGalleryPublicChange,
}: Props) {
  const [draft, setDraft] = useState<OrgCommunityDraft | null>(null)

  const loadPreviewCounts = useCallback(async () => {
    const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
    if (!r.ok) return
    const data = (await r.json()) as { organization: { community?: OrgCommunityDraft | null } }
    const c = data.organization.community
    setDraft({
      welcomeHtml: c?.welcomeHtml ?? '',
      faq: c?.faq ?? [],
      links: c?.links ?? [],
      communityModules: c?.communityModules ?? [],
    })
  }, [orgSlug])

  useEffect(() => {
    void loadPreviewCounts()
  }, [loadPreviewCounts])

  const welcomeSet = Boolean(draft?.welcomeHtml?.trim())
  const faqCount = draft?.faq?.length ?? 0
  const linkCount = draft?.links?.length ?? 0
  const moduleCount = draft?.communityModules?.length ?? 0

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
      <div className="order-2 min-w-0 space-y-5 xl:order-1">
        <SettingsSection className="border-sky-500/20 bg-sky-950/15">
          <p className="text-sm font-semibold text-sky-100">Org-level content only</p>
          <p className="mt-2 text-sm leading-relaxed text-sky-200/80">
            This section controls content for the whole organization, including the welcome message, FAQ, resource
            links, bio, gallery, and overview modules. Convention-specific schedules, event recaps, and group settings
            live in their own organizer areas.
          </p>
          <Link to={scheduleHref} className="mt-3 inline-block text-sm font-medium text-dc-accent hover:underline">
            Go to Events & conventions →
          </Link>
        </SettingsSection>

        <div>
          <SettingsSubsectionHeader
            title="Public hub content"
            subtitle="Edit organization-wide content that appears across your public hub."
          />
          <OrgContentEditorPanel
            orgSlug={orgSlug}
            autoOpen
            stickyFooter
            publicHubHref={publicHubHref}
            onSaved={(saved) => setDraft(saved)}
          />
        </div>

        <SettingsSection>
          <h4 className="text-sm font-semibold text-dc-text">About bio</h4>
          <p className="mt-1 text-sm text-dc-text-muted">Longer organization description on the About tab.</p>
          <div className="mt-4">
            <OrgBioEditorPanel orgSlug={orgSlug} />
          </div>
        </SettingsSection>

        <SettingsSection>
          <h4 className="text-sm font-semibold text-dc-text">Photo gallery</h4>
          <p className="mt-1 text-sm text-dc-text-muted">Images shown on the public About tab.</p>
          <div className="mt-4">
            <OrgGalleryAdminPanel
              orgSlug={orgSlug}
              galleryPublic={galleryPublic}
              onGalleryPublicChange={onGalleryPublicChange}
            />
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-dc-text-muted">
            <input
              type="checkbox"
              checked={galleryPublic ?? false}
              onChange={(e) => onGalleryPublicChange(e.target.checked)}
            />
            Gallery visible to non-members
          </label>
        </SettingsSection>

        <SettingsSection>
          <h4 className="text-sm font-semibold text-dc-text">Email list</h4>
          <p className="mt-1 text-sm text-dc-text-muted">Optional mailing-list signup on the public hub.</p>
          <div className="mt-4">
            <OrgEmailListPanel orgSlug={orgSlug} />
          </div>
        </SettingsSection>
      </div>

      <aside className="order-1 xl:order-2">
        <OverviewContentPreviewCard
          welcomeSet={welcomeSet}
          faqCount={faqCount}
          linkCount={linkCount}
          moduleCount={moduleCount}
          publicHubHref={publicHubHref}
        />
      </aside>
    </div>
  )
}
