import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import CommunityHubShell from '@/components/ui/CommunityHubShell'
import { formatOrgHubMetadata } from '@/components/org/hub/orgHubMeta'
import { resolvePublicSeedDisplayUrl } from '@/lib/public-seed-url'

function orgMediaDisplayUrl(url: string | null | undefined): string | undefined {
  return resolvePublicSeedDisplayUrl(url)
}

function orgInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export interface OrgCommunityShellProps {
  displayName: string
  slug: string
  bannerUrl?: string | null
  logoUrl?: string | null
  memberCount: number
  completedEventCount?: number
  rating?: number
  reviewCount?: number
  themeAccent?: string | null
  isMember: boolean
  canModerate: boolean
  tabs: readonly string[]
  activeTab: string
  onTabChange: (tab: string) => void
  onJoin: () => void
  onLeave: () => void
  children: ReactNode
  /** Rendered between the header card and sticky tabs (e.g. election banners). */
  beforeTabs?: ReactNode
  /** Rendered directly below the tab bar (e.g. status messages). */
  tabFooter?: ReactNode
  className?: string
}

export default function OrgCommunityShell({
  displayName,
  slug,
  bannerUrl,
  logoUrl,
  memberCount,
  completedEventCount = 0,
  rating = 0,
  reviewCount = 0,
  themeAccent,
  isMember,
  canModerate,
  tabs,
  activeTab,
  onTabChange,
  onJoin,
  onLeave,
  children,
  beforeTabs,
  tabFooter,
  className = '',
}: OrgCommunityShellProps) {
  const resolvedBanner = orgMediaDisplayUrl(bannerUrl)
  const resolvedLogo = orgMediaDisplayUrl(logoUrl)
  const metadataLine = formatOrgHubMetadata({
    slug,
    memberCount,
    completedEventCount,
    reviewCount,
    rating,
  })

  const header = (
    <div
      className="dc-card-polish c2k-community-hero mb-6 overflow-hidden rounded-2xl border border-dc-border shadow-[var(--dc-shadow-soft)]"
      style={themeAccent ? { borderColor: `${themeAccent}44` } : undefined}
    >
      <div className="relative w-full overflow-hidden bg-black c2k-community-hero-cover">
        <div className="relative mx-auto aspect-[21/9] w-full min-h-[5rem] max-h-28 sm:max-h-40 md:max-h-52">
          {resolvedBanner ?
            <img
              src={resolvedBanner}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[center_35%]"
            />
          : <div className="absolute inset-0 bg-gradient-to-br from-dc-accent/20 via-violet-950/45 to-slate-950 c2k-org-cover-fallback" aria-hidden />}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-dc-surface via-dc-surface/55 to-transparent"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-transparent" aria-hidden />
        </div>
      </div>

      <div className="relative bg-dc-surface px-4 pb-5 pt-0 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
            <div
              className="-mt-12 sm:-mt-14 flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-dc-surface bg-black/90 p-2 shadow-[var(--dc-shadow-soft)] sm:h-24 sm:w-24"
              aria-hidden={resolvedLogo ? undefined : true}
            >
              {resolvedLogo ?
                <img src={resolvedLogo} alt="" className="h-full w-full object-contain" />
              : <span className="text-xl font-bold text-amber-200/90 sm:text-2xl">{orgInitials(displayName)}</span>}
            </div>
            <div className="min-w-0 pb-0.5 pt-1 sm:pt-0">
              <h1 className="line-clamp-2 text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">{displayName}</h1>
              <p className="mt-1 text-sm leading-relaxed text-dc-muted">{metadataLine}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-lg border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-xs text-dc-text-muted">
                  {memberCount} members
                </span>
                {completedEventCount > 0 ?
                  <span className="rounded-lg border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-xs text-dc-text-muted">
                    {completedEventCount} events hosted
                  </span>
                : null}
                {reviewCount > 0 ?
                  <span className="rounded-lg border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-xs text-dc-text-muted">
                    {rating.toFixed(1)}★ · {reviewCount} reviews
                  </span>
                : null}
                {canModerate ?
                  <span className="rounded-lg border border-dc-accent-border/40 bg-dc-accent-muted/40 px-2 py-0.5 text-xs font-medium text-dc-accent">
                    Organizer
                  </span>
                : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {isMember ?
              <button
                type="button"
                onClick={onLeave}
                className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 py-2 text-sm font-medium text-dc-text-muted hover:text-dc-text"
              >
                Leave
              </button>
            : <button
                type="button"
                onClick={onJoin}
                className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                Join
              </button>
            }
            {canModerate ?
              <Link
                to={`/organizer/orgs/${encodeURIComponent(slug)}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-dc-accent-border/50 bg-dc-accent-muted px-4 py-2 text-sm font-semibold text-dc-accent hover:bg-dc-accent/15"
              >
                Organizer dashboard
              </Link>
            : null}
            <Link
              to="/guidelines"
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 py-2 text-sm font-medium text-dc-text-muted hover:text-dc-text"
            >
              Community guidelines
            </Link>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <CommunityHubShell
      tabsAriaLabel="Organization sections"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      header={header}
      beforeTabs={beforeTabs}
      tabFooter={tabFooter}
      tabVariant="gold"
      className={className}
    >
      {children}
    </CommunityHubShell>
  )
}

