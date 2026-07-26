import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { visibilityLabel } from '@/lib/organizer/build-org-checklist'
import type { HubTabPreview, SettingsSection } from '@/lib/organizer/org-settings-utils'
import { SETTINGS_SECTIONS } from '@/lib/organizer/org-settings-utils'
import { mediaDisplayUrl } from '@/lib/media-display-url'

export function SettingsSection({
  className,
  id,
  children,
}: {
  className?: string
  id?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn('rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 shadow-[var(--dc-shadow-soft)] sm:p-6', className)}
    >
      {children}
    </section>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

export function SettingsPageHeader() {
  return (
    <SettingsSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Public hub</p>
      <h2 className="mt-1 flex items-center gap-2.5 text-xl font-semibold text-dc-text sm:text-2xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/15 text-dc-accent">
          <SettingsIcon className="h-5 w-5" />
        </span>
        Organization settings
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-text-muted">
        Configure your organization identity, public hub, member features, content, branding, and publishing.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-text-muted">
        These settings affect the organization as a whole. Event, convention, and group-specific settings live in their
        own organizer areas.
      </p>
    </SettingsSection>
  )
}

export function SettingsSectionTabs({
  active,
  onChange,
}: {
  active: SettingsSection
  onChange: (s: SettingsSection) => void
}) {
  const blurb = SETTINGS_SECTIONS.find((s) => s.id === active)?.blurb ?? ''
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto pb-1">
        <div
          className="inline-flex min-w-full gap-1 rounded-xl border border-dc-border bg-dc-surface/40 p-1 sm:min-w-0"
          role="tablist"
          aria-label="Settings sections"
        >
          {SETTINGS_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active === s.id}
              onClick={() => onChange(s.id)}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center rounded-lg px-4 text-sm font-medium transition-colors',
                active === s.id ?
                  'bg-dc-accent text-dc-accent-foreground'
                : 'text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-dc-muted">{blurb}</p>
    </div>
  )
}

export function SettingsStatusMessage({
  message,
  isSuccess,
  onDismiss,
}: {
  message: string
  isSuccess: boolean
  onDismiss?: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 text-sm',
        isSuccess ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100' : 'border-red-500/30 bg-red-950/25 text-red-200',
      )}
      role={isSuccess ? 'status' : 'alert'}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1">{message}</p>
        {onDismiss && !isSuccess ?
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            Dismiss
          </button>
        : null}
      </div>
    </div>
  )
}

export function PublicHubPreviewCard({
  displayName,
  visibility,
  logoUrl,
  bannerUrl,
  publicHubHref,
  aboutHref,
  externalEnabled,
  externalUrl,
  embedOn,
}: {
  displayName: string
  visibility: string
  logoUrl: string | null
  bannerUrl: string | null
  publicHubHref: string
  aboutHref: string
  externalEnabled: boolean
  externalUrl: string | null
  embedOn: boolean
}) {
  const banner = mediaDisplayUrl(bannerUrl)
  const logo = mediaDisplayUrl(logoUrl)
  return (
    <SettingsSection>
      <h3 className="text-sm font-semibold text-dc-text">Public hub preview</h3>
      <div className="mt-3 overflow-hidden rounded-xl border border-dc-border">
        <div className="relative aspect-[3/1] bg-dc-surface-muted">
          {banner ?
            <img src={banner} alt="" className="h-full w-full object-cover" />
          : (
            <div className="flex h-full items-center justify-center text-xs text-dc-muted">No banner</div>
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
            <p className="truncate font-medium text-dc-text">{displayName}</p>
            <Badge variant={visibility === 'PUBLIC' ? 'success' : 'neutral'} className="mt-1">
              {visibilityLabel(visibility)}
            </Badge>
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex justify-between gap-2">
          <span className="text-dc-text-muted">Hub URL</span>
          <span className="truncate font-mono text-xs text-dc-text">/orgs/…</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-dc-text-muted">About embed</span>
          <span className="text-dc-text">
            {externalEnabled && embedOn && externalUrl ? 'Configured' : 'Off'}
          </span>
        </li>
      </ul>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          to={publicHubHref}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
        >
          View public hub
        </Link>
        <Link to={aboutHref} className="text-sm font-medium text-dc-accent hover:underline">
          Open About tab →
        </Link>
      </div>
    </SettingsSection>
  )
}

export function HubTabsPreviewCard({ tabs }: { tabs: HubTabPreview[] }) {
  return (
    <SettingsSection>
      <h3 className="text-sm font-semibold text-dc-text">Public hub tabs</h3>
      <p className="mt-1 text-xs text-dc-muted">What members and visitors see on the organization page.</p>
      <ul className="mt-3 space-y-2">
        {tabs.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-dc-text">{t.label}</span>
            {t.alwaysOn ?
              <span className="text-xs text-dc-muted">Always on</span>
            : (
              <Badge variant={t.shown ? 'success' : 'neutral'}>{t.shown ? 'Shown' : 'Hidden'}</Badge>
            )}
          </li>
        ))}
      </ul>
    </SettingsSection>
  )
}

export function BrandingTipsCard() {
  return (
    <SettingsSection>
      <h3 className="text-sm font-semibold text-dc-text">Branding tips</h3>
      <ul className="mt-3 space-y-2 text-sm text-dc-text-muted">
        <li>Use readable images with low clutter.</li>
        <li>Avoid explicit imagery in public branding.</li>
        <li>Use a square logo for best cropping.</li>
        <li>Use a wide banner for hub headers.</li>
      </ul>
      <a href="/support/branding" className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
        Branding guide →
      </a>
    </SettingsSection>
  )
}

export function OverviewContentPreviewCard({
  welcomeSet,
  faqCount,
  linkCount,
  moduleCount,
  publicHubHref,
}: {
  welcomeSet: boolean
  faqCount: number
  linkCount: number
  moduleCount: number
  publicHubHref: string
}) {
  return (
    <SettingsSection>
      <h3 className="text-sm font-semibold text-dc-text">Overview preview</h3>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex justify-between">
          <span className="text-dc-text-muted">Welcome</span>
          <span className="text-dc-text">{welcomeSet ? 'Set' : 'Empty'}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-dc-text-muted">FAQ items</span>
          <span className="text-dc-text">{faqCount}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-dc-text-muted">Resource links</span>
          <span className="text-dc-text">{linkCount}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-dc-text-muted">Modules</span>
          <span className="text-dc-text">{moduleCount}</span>
        </li>
      </ul>
      <Link to={publicHubHref} className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
        View public hub →
      </Link>
    </SettingsSection>
  )
}

export function PublishReadinessCard({
  checks,
}: {
  checks: { label: string; done: boolean }[]
}) {
  return (
    <SettingsSection>
      <h3 className="text-sm font-semibold text-dc-text">Before publishing</h3>
      <ul className="mt-3 space-y-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-sm">
            {c.done ?
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeWidth={2} strokeLinecap="round" d="M5 13l4 4L19 7" />
              </svg>
            : (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full border border-dc-border" aria-hidden />
            )}
            <span className={c.done ? 'text-dc-text' : 'text-dc-text-muted'}>{c.label}</span>
          </li>
        ))}
      </ul>
      <Link to="/support" className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
        Publishing guide →
      </Link>
    </SettingsSection>
  )
}

export function SettingsHelpStrip({ orgSlug }: { orgSlug: string }) {
  const base = `/organizer/orgs/${encodeURIComponent(orgSlug)}`
  const hub = `/orgs/${encodeURIComponent(orgSlug)}?tab=Overview`
  return (
    <SettingsSection className="border-dc-border/80 bg-dc-surface/20">
      <p className="text-sm leading-relaxed text-dc-text-muted">
        <span className="font-medium text-dc-text">Need member roles or volunteer tags?</span> Go to{' '}
        <Link to={`${base}?tab=people`} className="text-dc-accent hover:underline">
          People
        </Link>
        . <span className="font-medium text-dc-text">Forum or chat moderation?</span> Go to{' '}
        <Link to={`${base}?tab=communications`} className="text-dc-accent hover:underline">
          Communications
        </Link>
        . <span className="font-medium text-dc-text">Preview the member-facing page?</span>{' '}
        <Link to={hub} className="text-dc-accent hover:underline">
          View public hub
        </Link>
        .
      </p>
    </SettingsSection>
  )
}

export function SettingsStickyFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'sticky z-10 -mx-1 mt-6 border-t border-dc-border bg-[var(--organizer-panel-bg)]/95 px-4 py-4 backdrop-blur-sm sm:-mx-2 c2k-sticky-above-bottom-nav',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export function SettingsSubsectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-lg font-semibold text-dc-text">{title}</h3>
      <p className="mt-1 text-sm text-dc-text-muted">{subtitle}</p>
    </div>
  )
}
