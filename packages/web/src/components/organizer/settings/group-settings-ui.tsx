import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import { SettingsSection } from '@/components/organizer/settings/settings-ui'

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.75}
        strokeLinecap="round"
        d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
      />
    </svg>
  )
}

function groupVisibilityLabel(visibility: string): string {
  if (visibility === 'invite-only') return 'Invite only'
  if (visibility === 'owner_absent') return 'Owner absent'
  return visibility.charAt(0).toUpperCase() + visibility.slice(1)
}

export function GroupSettingsPageHeader() {
  return (
    <SettingsSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Public group page</p>
      <h2 className="mt-1 flex items-center gap-2.5 text-xl font-semibold text-dc-text sm:text-2xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/15 text-dc-accent">
          <SettingsIcon className="h-5 w-5" />
        </span>
        Group settings
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-text-muted">
        Branding, metadata, and listing details for this group. Changes apply to the public group hub and discovery cards.
      </p>
    </SettingsSection>
  )
}

export function GroupPublicHubPreviewCard({
  groupId,
  name,
  visibility,
  bannerUrl,
  logoUrl,
}: {
  groupId: string
  name: string
  visibility: string
  bannerUrl: string | null
  logoUrl: string | null
}) {
  const banner = mediaDisplayUrl(bannerUrl)
  const logo = mediaDisplayUrl(logoUrl)
  const publicHref = `/groups/${encodeURIComponent(groupId)}`

  return (
    <SettingsSection>
      <h3 className="text-sm font-semibold text-dc-text">Live preview</h3>
      <p className="mt-1 text-xs text-dc-muted">Banner and logo as members see them on the group page header.</p>
      <div className="mt-3 overflow-hidden rounded-xl border border-dc-border">
        <div className="relative aspect-[3/1] bg-dc-surface-muted">
          {banner ?
            <img src={banner} alt="" className="h-full w-full object-cover" />
          : (
            <div className="flex h-full items-center justify-center text-xs text-dc-muted">No banner yet</div>
          )}
        </div>
        <div className="flex gap-3 border-t border-dc-border bg-dc-surface/40 p-3">
          {logo ?
            <img src={logo} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-dc-border object-cover" />
          : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-dc-border text-[10px] text-dc-muted">
              Logo
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-dc-text">{name}</p>
            <Badge variant={visibility === 'public' ? 'success' : 'neutral'} className="mt-1">
              {groupVisibilityLabel(visibility)}
            </Badge>
          </div>
        </div>
      </div>
      <Link
        to={publicHref}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted transition-colors hover:border-dc-border-strong hover:text-dc-text"
      >
        View public group page
      </Link>
    </SettingsSection>
  )
}
