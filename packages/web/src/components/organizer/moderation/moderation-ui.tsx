import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { MODERATION_PRINCIPLES } from '@/lib/organizer/org-moderation-utils'
import { visibilityLabel } from '@/lib/organizer/build-org-checklist'

export function ModSection({
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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M12 3l7 4v5c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V7l7-4z" />
    </svg>
  )
}

export function ModerationPageHeader({
  publicHubHref,
  showSettings,
  settingsContentHref,
}: {
  publicHubHref: string
  showSettings: boolean
  settingsContentHref: string
}) {
  return (
    <ModSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Safety</p>
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-dc-text sm:text-2xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/15 text-dc-accent">
              <ShieldIcon className="h-5 w-5" />
            </span>
            Moderation
          </h2>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Review reports, manage bans, and keep your organization spaces safe.
          </p>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Reports from forums, chat, events, and community spaces appear here when members flag something for
            review.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to={publicHubHref}
            className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:border-dc-border-strong hover:text-dc-text"
          >
            View public hub
          </Link>
          <Link
            to="/support"
            className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:border-dc-accent-border/40 hover:text-dc-text"
          >
            Open moderation guide
          </Link>
          {showSettings ?
            <Link
              to={settingsContentHref}
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
            >
              Community content
            </Link>
          : null}
        </div>
      </div>
    </ModSection>
  )
}

export type ModStatusCard = {
  label: string
  value: string
  sub: string
  urgent?: boolean
  healthy?: boolean
  href?: string
  linkLabel?: string
}

export function ModerationStatusRow({ cards }: { cards: ModStatusCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            'rounded-xl border border-dc-border bg-dc-surface/50 px-3 py-3',
            c.urgent && 'border-red-500/30 bg-red-950/15',
            c.healthy && 'border-emerald-500/25 bg-emerald-950/10',
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-dc-text-muted">{c.label}</p>
          <p className={cn('mt-1 text-lg font-semibold', c.urgent ? 'text-red-200' : 'text-dc-text')}>{c.value}</p>
          <p className="mt-0.5 text-dc-micro leading-snug text-dc-muted">{c.sub}</p>
          {c.href && c.linkLabel ?
            <Link to={c.href} className="mt-2 inline-block text-xs font-medium text-dc-accent hover:underline">
              {c.linkLabel}
            </Link>
          : null}
        </div>
      ))}
    </div>
  )
}

export function ModerationSubTabs({
  active,
  onChange,
  inboxCount,
  bansCount,
  auditCount,
}: {
  active: 'inbox' | 'bans' | 'audit'
  onChange: (tab: 'inbox' | 'bans' | 'audit') => void
  inboxCount: number
  bansCount: number
  auditCount: number
}) {
  const tabs = [
    { id: 'inbox' as const, label: 'Inbox', count: inboxCount },
    { id: 'bans' as const, label: 'Bans', count: bansCount },
    { id: 'audit' as const, label: 'Audit', count: auditCount },
  ]
  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="inline-flex min-w-full gap-1 rounded-xl border border-dc-border bg-dc-surface/40 p-1 sm:min-w-0"
        role="tablist"
        aria-label="Moderation views"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors',
              active === t.id ?
                'bg-dc-accent/15 text-dc-accent'
              : 'text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text',
            )}
          >
            {t.label}
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 text-xs tabular-nums',
                active === t.id ? 'bg-dc-accent/20 text-dc-accent' : 'bg-dc-elevated-muted text-dc-muted',
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function SafetyPostureCard({
  openReports,
  forumsEnabled,
  chatEnabled,
  visibility,
  moderatorCount,
}: {
  openReports: number
  forumsEnabled: boolean
  chatEnabled: boolean
  visibility: string
  moderatorCount: number | null
}) {
  const rows = [
    { label: 'Open reports', value: String(openReports) },
    { label: 'Forums', value: forumsEnabled ? 'Enabled' : 'Disabled', success: forumsEnabled },
    { label: 'Chat', value: chatEnabled ? 'Enabled' : 'Disabled', success: chatEnabled },
    { label: 'Public hub', value: visibilityLabel(visibility) },
    {
      label: 'Moderators',
      value: moderatorCount === null ? '-' : String(moderatorCount),
    },
  ]
  return (
    <ModSection>
      <h3 className="text-sm font-semibold text-dc-text">Safety posture</h3>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-dc-text-muted">{r.label}</span>
            {'success' in r && r.success !== undefined ?
              <Badge variant={r.success ? 'success' : 'neutral'}>{r.value}</Badge>
            : (
              <span className="font-medium text-dc-text">{r.value}</span>
            )}
          </li>
        ))}
      </ul>
    </ModSection>
  )
}

export function ModerationPrinciplesCard() {
  return (
    <ModSection>
      <h3 className="text-sm font-semibold text-dc-text">Moderation principles</h3>
      <ul className="mt-3 space-y-2">
        {MODERATION_PRINCIPLES.map((p) => (
          <li key={p} className="flex gap-2 text-sm text-dc-text-muted">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-dc-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeWidth={2} strokeLinecap="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </ModSection>
  )
}

export function MemberSpacesModerationCard({
  forumsEnabled,
  chatEnabled,
  forumsHref,
  chatHref,
  publicHubHref,
}: {
  forumsEnabled: boolean
  chatEnabled: boolean
  forumsHref: string
  chatHref: string
  publicHubHref: string
}) {
  return (
    <ModSection>
      <h3 className="text-sm font-semibold text-dc-text">Member-facing spaces</h3>
      <p className="mt-2 text-sm text-dc-text-muted">
        See and participate in your community from the public organization hub.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {forumsEnabled ?
          <Link
            to={forumsHref}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
          >
            Open member forums
          </Link>
        : null}
        {chatEnabled ?
          <Link
            to={chatHref}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
          >
            Open member chat
          </Link>
        : null}
        <Link
          to={publicHubHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          View public hub
        </Link>
      </div>
    </ModSection>
  )
}

export function ModerationTipBar() {
  return (
    <ModSection className="border-dc-accent/20 bg-dc-accent/5">
      <p className="text-sm leading-relaxed text-dc-text-muted">
        <span className="font-medium text-dc-text">Tip:</span> Clear rules and active moderation build trust. Set
        community expectations, respond to issues, and keep conversations healthy.
      </p>
      <Link to="/support" className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-dc-accent hover:underline">
        Learn best practices →
      </Link>
    </ModSection>
  )
}
