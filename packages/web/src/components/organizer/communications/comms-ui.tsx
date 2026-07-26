import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { SUGGESTED_SETUP_ITEMS } from '@/lib/organizer/org-comms-utils'

export function CommsSection({
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

function CommsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z"
      />
    </svg>
  )
}

export function CommsPageHeader({
  forumsEnabled,
  chatEnabled,
  forumsHref,
  chatHref,
  publicHubHref,
  showSettings,
  settingsFeaturesHref,
}: {
  forumsEnabled: boolean
  chatEnabled: boolean
  forumsHref: string
  chatHref: string
  publicHubHref: string
  showSettings: boolean
  settingsFeaturesHref: string
}) {
  return (
    <CommsSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Community</p>
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-dc-text sm:text-2xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/15 text-dc-accent">
              <CommsIcon className="h-5 w-5" />
            </span>
            Communications
          </h2>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Manage the forums and chat spaces your members use on the public organization hub.
          </p>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Set up the structure for your member forums and chat. Members participate from the public organization hub.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-dc-text-muted">
            <li>Forums are best for longer discussions and announcements.</li>
            <li>Chat is best for quick updates, planning, and real-time coordination.</li>
          </ul>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          {forumsEnabled ?
            <Link
              to={forumsHref}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Open member forums
            </Link>
          : null}
          {chatEnabled ?
            <Link
              to={chatHref}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
            >
              Open member chat
            </Link>
          : null}
          {showSettings ?
            <details className="relative">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted marker:content-none hover:text-dc-text [&::-webkit-details-marker]:hidden">
                Configure features
              </summary>
              <div className="absolute right-0 z-10 mt-1 min-w-[12rem] rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-lg">
                <Link
                  to={settingsFeaturesHref}
                  className="block px-4 py-2 text-sm text-dc-text hover:bg-dc-elevated-muted"
                >
                  Feature flags
                </Link>
              </div>
            </details>
          : null}
        </div>
      </div>
      {(!forumsEnabled || !chatEnabled) && showSettings ?
        <p className="mt-4 text-sm text-amber-200/90">
          {!forumsEnabled && !chatEnabled ?
            'Forums and chat are disabled for members.'
          : !forumsEnabled ?
            'Forums are disabled for members.'
          : (
            'Chat is disabled for members.'
          )}{' '}
          <Link to={settingsFeaturesHref} className="font-medium text-dc-accent hover:underline">
            Enable in Settings → Features
          </Link>
        </p>
      : null}
      {!forumsEnabled && !chatEnabled && !showSettings ?
        <p className="mt-4 text-sm text-dc-text-muted">
          Some communication features are disabled. Ask an organization admin to enable forums or chat.
        </p>
      : null}
      <p className="mt-4 text-sm">
        <Link to={publicHubHref} className="font-medium text-dc-accent hover:underline">
          Preview public hub →
        </Link>
      </p>
    </CommsSection>
  )
}

type StatusCard = {
  label: string
  value: string
  sub: string
  enabled?: boolean
  href?: string
  linkLabel?: string
}

export function CommsStatusRow({ cards }: { cards: StatusCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            'rounded-xl border border-dc-border bg-dc-surface/50 px-3 py-3',
            c.enabled === true && 'border-emerald-500/25 bg-emerald-950/10',
            c.enabled === false && 'border-dc-border/80 opacity-90',
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-dc-text-muted">{c.label}</p>
          <p className="mt-1 text-lg font-semibold text-dc-text">{c.value}</p>
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

export function MemberFacingSpacesCard({
  forumsEnabled,
  chatEnabled,
  forumsHref,
  chatHref,
  publicHubHref,
  forumCategoryCount,
  channelCount,
}: {
  forumsEnabled: boolean
  chatEnabled: boolean
  forumsHref: string
  chatHref: string
  publicHubHref: string
  forumCategoryCount?: number
  channelCount?: number
}) {
  const forumsReady = forumsEnabled && (forumCategoryCount ?? 0) > 0
  const chatReady = chatEnabled && (channelCount ?? 0) > 0
  return (
    <CommsSection>
      <h3 className="text-sm font-semibold text-dc-text">Member-facing spaces</h3>
      <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
        Members use these spaces on the public organization hub. Configure structure here, participate there.
      </p>
      <ul className="mt-4 space-y-3">
        <li className="flex items-center justify-between gap-2 rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5">
          <span className="text-sm text-dc-text">Forums tab</span>
          <Badge variant={forumsReady ? 'success' : forumsEnabled ? 'accent' : 'neutral'}>
            {forumsReady ? 'Ready' : forumsEnabled ? 'Needs categories' : 'Disabled'}
          </Badge>
        </li>
        <li className="flex items-center justify-between gap-2 rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5">
          <span className="text-sm text-dc-text">Chat tab</span>
          <Badge variant={chatReady ? 'success' : chatEnabled ? 'accent' : 'neutral'}>
            {chatReady ? 'Ready' : chatEnabled ? 'Needs channels' : 'Disabled'}
          </Badge>
        </li>
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-dc-muted">
        {forumsEnabled && !forumsReady ?
          'Forums are visible on the hub, but members cannot post until you add at least one category. '
        : ''}
        {chatEnabled && !chatReady ?
          'Chat is visible on the hub, but members cannot message until you create at least one channel.'
        : forumsReady || chatReady ?
          'Members browse categories, start threads, and join channels you define below.'
        : ''}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {forumsReady ?
          <Link
            to={forumsHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Open member forums
          </Link>
        : null}
        {chatReady ?
          <Link
            to={chatHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
          >
            Open member chat
          </Link>
        : null}
        <Link to={publicHubHref} className="text-sm font-medium text-dc-accent hover:underline">
          Preview public hub →
        </Link>
      </div>
    </CommsSection>
  )
}

export function SuggestedSetupCard() {
  return (
    <CommsSection>
      <h3 className="text-sm font-semibold text-dc-text">Suggested communication setup</h3>
      <ul className="mt-3 space-y-2.5">
        {SUGGESTED_SETUP_ITEMS.map((item) => (
          <li key={item.name} className="text-sm">
            <span className="font-medium text-dc-text">{item.name}</span>
            <span className="text-dc-text-muted"> · {item.detail}</span>
          </li>
        ))}
      </ul>
      <Link to="/support" className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
        See best practices →
      </Link>
    </CommsSection>
  )
}

export function ModerationReminderCard({ moderationHref }: { moderationHref: string }) {
  return (
    <CommsSection className="border-sky-500/20 bg-sky-950/10">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300" aria-hidden>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth={1.75} strokeLinecap="round" d="M12 3l7 4v5c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V7l7-4z" />
          </svg>
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-dc-text">Moderation reminder</h3>
          <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
            Clear categories and channel names make moderation easier. Use slow mode, pinned posts, and clear
            expectations where supported.
          </p>
          <Link to={moderationHref} className="mt-3 inline-block text-sm font-medium text-dc-accent hover:underline">
            View moderation tools →
          </Link>
        </div>
      </div>
    </CommsSection>
  )
}

export function CommsBottomCta({ publicHubHref }: { publicHubHref: string }) {
  return (
    <CommsSection className="border-dc-border/80 bg-dc-surface/20">
      <p className="text-sm font-medium text-dc-text">New here? Start building your community.</p>
      <p className="mt-1 text-sm text-dc-text-muted">
        Add a forum category and a chat channel, then share your public hub so members can find you.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/support" className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text">
          Learn more
        </Link>
        <Link
          to={publicHubHref}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Open member hub
        </Link>
      </div>
    </CommsSection>
  )
}

export function GroupCommsPageHeader({
  forumsHref,
  publicGroupHref,
}: {
  forumsHref: string
  publicGroupHref: string
}) {
  return (
    <CommsSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Community</p>
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-dc-text sm:text-2xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/15 text-dc-accent">
              <CommsIcon className="h-5 w-5" />
            </span>
            Communications
          </h2>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Set up forum categories for your group. Members browse threads and post from the public group page.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-dc-text-muted">
            <li>Forums work best for introductions, announcements, and longer discussions.</li>
            <li>Photo moderation and live chat admin tools are coming in a later beta release.</li>
          </ul>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            to={forumsHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Open member forums
          </Link>
          <Link
            to={publicGroupHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
          >
            View group page
          </Link>
        </div>
      </div>
      <p className="mt-4 text-sm">
        <Link to={publicGroupHref} className="font-medium text-dc-accent hover:underline">
          Preview public group page →
        </Link>
      </p>
    </CommsSection>
  )
}

export function GroupMemberFacingSpacesCard({
  forumsHref,
  publicGroupHref,
  forumCategoryCount,
}: {
  forumsHref: string
  publicGroupHref: string
  forumCategoryCount: number
}) {
  const forumsReady = forumCategoryCount > 0
  return (
    <CommsSection>
      <h3 className="text-sm font-semibold text-dc-text">Member-facing spaces</h3>
      <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
        Members use the Forums tab on your public group page. Configure categories here; they participate there.
      </p>
      <ul className="mt-4 space-y-3">
        <li className="flex items-center justify-between gap-2 rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5">
          <span className="text-sm text-dc-text">Forums tab</span>
          <Badge variant={forumsReady ? 'success' : 'accent'}>
            {forumsReady ? 'Ready' : 'Needs categories'}
          </Badge>
        </li>
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-dc-muted">
        {forumsReady ?
          'Members can browse categories and start threads you define below.'
        : 'Forums are visible on the group page, but members cannot post until you add at least one category.'}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          to={forumsHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Open member forums
        </Link>
        <Link to={publicGroupHref} className="text-sm font-medium text-dc-accent hover:underline">
          Preview group page →
        </Link>
      </div>
    </CommsSection>
  )
}

export function GroupCommsBottomCta({ publicGroupHref }: { publicGroupHref: string }) {
  return (
    <CommsSection className="border-dc-border/80 bg-dc-surface/20">
      <p className="text-sm font-medium text-dc-text">Ready for members?</p>
      <p className="mt-1 text-sm text-dc-text-muted">
        Add your first forum category, then share the group page so members know where to introduce themselves.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/support" className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text">
          Learn more
        </Link>
        <Link
          to={publicGroupHref}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Open group page
        </Link>
      </div>
    </CommsSection>
  )
}

function AlphaPlaceholder({ description }: { description: string }) {
  return (
    <div
      className="rounded-xl border border-dashed border-dc-border bg-dc-surface/30 px-4 py-5 text-sm text-dc-text-muted"
      aria-disabled="true"
    >
      <p className="font-medium text-dc-text">Beta · Not available yet</p>
      <p className="mt-2 leading-relaxed">{description}</p>
    </div>
  )
}

export function GroupCommsAlphaSection({ publicGroupHref }: { publicGroupHref: string }) {
  return (
    <CommsSection id="comms-alpha">
      <div className="max-w-2xl">
        <h3 className="text-lg font-semibold text-dc-text">Coming soon</h3>
        <p className="mt-1 text-sm text-dc-text-muted">
          Photo moderation and live chat admin will appear here in a later beta release.
        </p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-dc-text">Photo approval queue</h4>
          <p className="mt-1 text-xs text-dc-muted">Review member uploads before they appear in the gallery.</p>
          <div className="mt-3">
            <AlphaPlaceholder
              description="Group photo moderation is not wired in this build. Member uploads continue on the public group page."
            />
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-dc-text">Live chat channels</h4>
          <p className="mt-1 text-xs text-dc-muted">Slow mode, pinned messages, and channel moderation.</p>
          <div className="mt-3">
            <AlphaPlaceholder
              description="Group chat admin is not available in the organizer console yet. Forum categories above are the primary communication tool."
            />
          </div>
        </div>
      </div>
      <Link
        to={publicGroupHref}
        className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-accent hover:underline"
      >
        Open group page
      </Link>
    </CommsSection>
  )
}
