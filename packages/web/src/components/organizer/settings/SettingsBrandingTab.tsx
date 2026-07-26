import ScopeBrandingPanel from '@/components/organizer/ScopeBrandingPanel'
import {
  BrandingTipsCard,
  PublicHubPreviewCard,
  SettingsSubsectionHeader,
} from '@/components/organizer/settings/settings-ui'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import type { BrandingAssetKind } from '@/components/organizer/ScopeBrandingPanel'

type Props = {
  org: {
    displayName: string
    visibility: string
    bio?: string | null
    bannerUrl: string | null
    logoUrl: string | null
    shareImageUrl?: string | null
    featureFlags: { externalEmbedEnabled: boolean }
    externalSiteUrl: string | null
    showExternalEmbed: boolean
  }
  publicHubHref: string
  aboutHref: string
  uploading: BrandingAssetKind | null
  onUpload: (kind: BrandingAssetKind) => void
  onClear: (kind: BrandingAssetKind) => void
}

export default function SettingsBrandingTab({
  org,
  publicHubHref,
  aboutHref,
  uploading,
  onUpload,
  onClear,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
      <div className="space-y-5">
        <div>
          <SettingsSubsectionHeader
            title="Branding"
            subtitle="Upload images that make your public hub and shared links recognizable."
          />
          <ScopeBrandingPanel
            scopeLabel={org.displayName}
            title={org.displayName}
            description={org.bio ?? undefined}
            bannerUrl={org.bannerUrl}
            logoUrl={org.logoUrl}
            shareImageUrl={org.shareImageUrl ?? null}
            uploading={uploading}
            onUpload={onUpload}
            onClear={onClear}
          />
        </div>

        <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 sm:p-6">
          <h4 className="text-sm font-semibold text-dc-text">Public hub preview</h4>
          <p className="mt-1 text-xs text-dc-muted">Banner and logo as members see them on the hub header.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-dc-border">
            <div className="aspect-[3/1] bg-dc-surface-muted">
              {mediaDisplayUrl(org.bannerUrl) ?
                <img src={mediaDisplayUrl(org.bannerUrl)!} alt="" className="h-full w-full object-cover" />
              : (
                <div className="flex h-full items-center justify-center text-xs text-dc-muted">Upload a banner</div>
              )}
            </div>
            <div className="flex items-center gap-3 border-t border-dc-border p-4">
              {mediaDisplayUrl(org.logoUrl) ?
                <img src={mediaDisplayUrl(org.logoUrl)!} alt="" className="h-14 w-14 rounded-xl border border-dc-border object-cover" />
              : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-dc-border text-[10px] text-dc-muted">
                  Logo
                </div>
              )}
              <div>
                <p className="font-medium text-dc-text">{org.displayName}</p>
                <p className="text-xs text-dc-muted">Public organization hub</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-5">
        <PublicHubPreviewCard
          displayName={org.displayName}
          visibility={org.visibility}
          logoUrl={org.logoUrl}
          bannerUrl={org.bannerUrl}
          publicHubHref={publicHubHref}
          aboutHref={aboutHref}
          externalEnabled={org.featureFlags.externalEmbedEnabled}
          externalUrl={org.externalSiteUrl}
          embedOn={org.showExternalEmbed}
        />
        <BrandingTipsCard />
      </aside>
    </div>
  )
}
