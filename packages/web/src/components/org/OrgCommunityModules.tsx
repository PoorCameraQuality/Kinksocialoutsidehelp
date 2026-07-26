import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import EducationArticleCard from '@/components/education/EducationArticleCard'
import type { CommunityPageModule } from '@/types/org-community-modules'

type OrgEventPick = {
  id: string
  title: string
  startsAt: string
  location?: string | null
  hasProgram?: boolean
  conventionSlug?: string | null
}

type FeaturedVendorRow = {
  vendorProfileId: string
  slug: string
  displayName: string
  logoUrl: string | null
  label: string | null
}

type FeaturedArticleRow = {
  educationArticleId: string
  sortOrder: number
  label: string | null
  slug: string
  title: string
  excerpt: string | null
  heroImageUrl: string | null
  authorUsername: string
}

function beginnerFriendlyTitle(title: string): boolean {
  const t = title.toLowerCase()
  return /\b(intro|101|beginner|newcomer|orientation|first\s+timer|welcome\s+circle)\b/.test(t)
}

function moduleTitle(m: CommunityPageModule, fallback: string): string {
  const t = m.title?.trim()
  return t || fallback
}

export type OrgContactRow = { role: string; detail: string; href?: string | null }

export function OrgContactsBlock({
  title,
  rows,
  compact = false,
}: {
  title: string
  rows: OrgContactRow[]
  compact?: boolean
}) {
  return (
    <>
      <h2
        className={
          compact ?
            'text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-2'
          : 'text-sm font-semibold text-dc-muted uppercase mb-3'
        }
      >
        {title}
      </h2>
      <ul className={compact ? 'space-y-2' : 'space-y-3'}>
        {rows.map((row, i) => (
          <li
            key={i}
            className={
              compact ?
                'rounded-lg border border-dc-border bg-dc-elevated-solid p-2'
              : 'rounded-xl border border-dc-border bg-dc-elevated-solid p-3'
            }
          >
            <p className={compact ? 'text-xs font-medium text-dc-text' : 'text-sm font-medium text-dc-text'}>{row.role}</p>
            {row.href ?
              <a
                href={row.href}
                className={
                  compact ?
                    'text-xs text-dc-accent hover:underline mt-0.5 inline-block break-all'
                  : 'text-sm text-dc-accent hover:underline mt-1 inline-block'
                }
                target="_blank"
                rel="noreferrer"
              >
                {row.detail}
              </a>
            : <p
                className={
                  compact ?
                    'text-xs text-dc-text-muted mt-0.5 whitespace-pre-wrap'
                  : 'text-sm text-dc-text-muted mt-1 whitespace-pre-wrap'
                }
              >
                {row.detail}
              </p>
            }
          </li>
        ))}
      </ul>
    </>
  )
}

export type OrgAnnouncementItem = {
  title: string
  body: string
  dateLabel?: string | null
  link?: string | null
}

export function OrgAnnouncementsBlock({
  title,
  items,
  compact = false,
  maxItems,
  layout = 'list',
}: {
  title: string
  items: OrgAnnouncementItem[]
  compact?: boolean
  /** When set, only the first N announcements are shown. */
  maxItems?: number
  /** `strip`: compact horizontal cards for overview top strip. */
  layout?: 'list' | 'strip'
}) {
  const shown = maxItems != null ? items.slice(0, maxItems) : items
  const isStrip = layout === 'strip'
  return (
    <>
      <h2
        className={
          compact ?
            'text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-2'
          : 'text-sm font-semibold text-dc-muted uppercase mb-3'
        }
      >
        {title}
      </h2>
      <ul
        className={
          isStrip ?
            'flex flex-col sm:flex-row gap-3 sm:gap-4'
          : compact ?
            'space-y-2'
          : 'space-y-4'
        }
      >
        {shown.map((it, i) => (
          <li
            key={i}
            className={
              isStrip ?
                'flex-1 min-w-0 rounded-lg border border-dc-border bg-dc-elevated-solid/80 px-3 py-2'
              : compact ?
                'border-l-2 border-dc-accent/45 pl-2.5'
              : 'border-l-2 border-dc-accent-border/50 pl-4'
            }
          >
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
              <p
                className={
                  isStrip ?
                    'text-xs font-semibold text-dc-text'
                  : compact ?
                    'text-xs font-medium text-dc-text'
                  : 'text-sm font-medium text-dc-text'
                }
              >
                {it.title}
              </p>
              {it.dateLabel ?
                <span
                  className={
                    isStrip ?
                      'text-[10px] text-dc-muted'
                    : compact ?
                      'text-[10px] text-dc-muted'
                    : 'text-[11px] text-dc-muted'
                  }
                >
                  {it.dateLabel}
                </span>
              : null}
            </div>
            <p
              className={
                isStrip ?
                  'text-[11px] text-dc-text-muted mt-1 whitespace-pre-wrap line-clamp-2'
                : compact ?
                  'text-[11px] text-dc-text-muted mt-0.5 whitespace-pre-wrap line-clamp-3'
                : 'text-sm text-dc-text-muted mt-1 whitespace-pre-wrap'
              }
            >
              {it.body}
            </p>
            {it.link ?
              <a
                href={it.link}
                className={
                  isStrip ?
                    'text-[10px] text-dc-accent hover:underline mt-1 inline-block'
                  : compact ?
                    'text-[10px] text-dc-accent hover:underline mt-1 inline-block'
                  : 'text-xs text-dc-accent hover:underline mt-2 inline-block'
                }
                target="_blank"
                rel="noreferrer"
              >
                More →
              </a>
            : null}
          </li>
        ))}
      </ul>
    </>
  )
}

export type OrgDocumentLinkItem = {
  label: string
  url: string
  kind?: 'pdf' | 'doc' | 'sheet' | 'link' | 'other'
}

export function OrgDocumentsBlock({ title, items }: { title: string; items: OrgDocumentLinkItem[] }) {
  return (
    <>
      <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">{title}</h2>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            {it.kind ?
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-dc-elevated-muted text-dc-muted">
                {it.kind}
              </span>
            : null}
            <a href={it.url} target="_blank" rel="noreferrer" className="text-dc-accent hover:underline">
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

export function OrgVolunteerBlock({
  title,
  bodyHtml,
  signupUrl,
  compact = false,
}: {
  title: string
  bodyHtml?: string | null
  signupUrl?: string | null
  compact?: boolean
}) {
  return (
    <>
      <h2
        className={
          compact ?
            'text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-2'
          : 'text-sm font-semibold text-dc-muted uppercase mb-3'
        }
      >
        {title}
      </h2>
      {bodyHtml ?
        <div
          className={
            compact ?
              'c2k-rich-html prose prose-invert prose-sm max-w-none text-dc-text-muted prose-a:text-dc-accent mb-2 [&_p]:text-xs [&_p]:my-1'
            : 'c2k-rich-html prose prose-invert prose-sm max-w-none text-dc-text-muted prose-a:text-dc-accent mb-3'
          }
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      : null}
      {signupUrl ?
        <a
          href={signupUrl}
          target="_blank"
          rel="noreferrer"
          className={
            compact ?
              'inline-flex min-h-8 items-center px-3 rounded-lg bg-dc-accent text-dc-accent-foreground text-xs font-medium'
            : 'inline-flex min-h-10 items-center px-4 rounded-xl bg-dc-accent text-dc-accent-foreground text-sm font-medium'
          }
        >
          Sign up
        </a>
      : null}
    </>
  )
}

export function OrgFeaturedArticlesBlock({
  orgSlug,
  maxItems,
  emptyMessage,
}: {
  orgSlug: string
  maxItems: number
  emptyMessage?: string
}) {
  const [items, setItems] = useState<FeaturedArticleRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/featured-articles`, {
          credentials: 'include',
        })
        if (!r.ok || cancelled) return
        const d = (await r.json()) as { items?: FeaturedArticleRow[] }
        setItems(Array.isArray(d.items) ? d.items.slice(0, maxItems) : [])
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgSlug, maxItems])

  if (items === null) {
    return <div className="h-20 animate-pulse rounded-xl bg-dc-elevated-muted" />
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-dc-muted">{emptyMessage || 'No featured articles yet. Admins can pin them via the API.'}</p>
    )
  }
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <EducationArticleCard
          key={a.educationArticleId}
          slug={a.slug}
          title={a.label?.trim() || a.title}
          excerpt={a.excerpt}
          heroImageUrl={a.heroImageUrl}
          subtitle={`@${a.authorUsername}`}
        />
      ))}
    </ul>
  )
}

export function OrgFeaturedVendorsBlock({
  orgSlug,
  maxItems,
  emptyMessage,
}: {
  orgSlug: string
  maxItems: number
  emptyMessage?: string
}) {
  const [items, setItems] = useState<FeaturedVendorRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/featured-vendors`, {
          credentials: 'include',
        })
        if (!r.ok || cancelled) return
        const d = (await r.json()) as { items?: FeaturedVendorRow[] }
        setItems(Array.isArray(d.items) ? d.items.slice(0, maxItems) : [])
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgSlug, maxItems])

  if (items === null) {
    return <div className="h-20 animate-pulse rounded-xl bg-dc-elevated-muted" />
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-dc-muted">
        {emptyMessage || 'No featured partners yet. Org admins can curate them in the API or a future admin panel.'}
      </p>
    )
  }
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((v) => (
        <li key={v.vendorProfileId}>
          <Link
            to={`/vendors/${encodeURIComponent(v.slug)}`}
            className="flex items-center gap-3 rounded-xl border border-dc-border bg-dc-elevated-solid p-3 hover:border-dc-accent-border/40 transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-black/30 overflow-hidden shrink-0 flex items-center justify-center">
              {v.logoUrl ?
                <img src={v.logoUrl} alt="" className="w-full h-full object-cover" />
              : <span className="text-[10px] text-dc-muted text-center px-1">Shop</span>}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-dc-text truncate">{v.label || v.displayName}</p>
              <p className="text-xs text-dc-muted truncate">{v.displayName}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function OrgCommunityModules({
  orgSlug,
  modules,
  events,
  isAuthenticated,
  orgReportAction,
  platformEscalationReportAction,
}: {
  orgSlug: string
  modules: CommunityPageModule[] | null | undefined
  events: OrgEventPick[] | null | undefined
  isAuthenticated: boolean
  orgReportAction?: ReactNode
  platformEscalationReportAction?: ReactNode
}) {
  const list = useMemo(() => (Array.isArray(modules) ? modules : []), [modules])

  const upcomingSorted = useMemo(() => {
    const evs = Array.isArray(events) ? [...events] : []
    evs.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    const now = Date.now()
    return evs.filter((e) => new Date(e.startsAt).getTime() >= now - 60 * 60 * 1000)
  }, [events])

  if (list.length === 0) return null

  return (
    <div className="space-y-6">
      {list.map((m) => {
        if (m.enabled === false) return null

        const wrap = (inner: ReactNode, key: string) => (
          <div key={key} className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)]">
            {inner}
          </div>
        )

        switch (m.type) {
          case 'richtext': {
            const v = m.variant ?? 'default'
            const shell =
              v === 'callout' ?
                'border-amber-500/35 bg-amber-500/5'
              : v === 'muted' ?
                'border-dc-border-subtle bg-black/20'
              : ''
            return wrap(
              <>
                <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
                  {moduleTitle(m, 'Community')}
                </h2>
                <div
                  className={`c2k-rich-html prose prose-invert prose-sm max-w-none text-dc-text-muted prose-a:text-dc-accent rounded-xl border p-4 ${shell}`}
                  dangerouslySetInnerHTML={{ __html: m.html }}
                />
              </>,
              m.id
            )
          }
          case 'checklist':
            return wrap(
              <>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-dc-muted mb-2">
                  {moduleTitle(m, 'Your first week here')}
                </h2>
                <ol className="c2k-empty-state-compact space-y-2 rounded-xl border border-dc-border bg-dc-elevated-muted/30 p-3 text-sm text-dc-text-muted list-decimal list-inside">
                  {m.items.map((it, i) => (
                    <li key={i} className="pl-1">
                      {it.href ?
                        <a href={it.href} className="text-dc-accent hover:underline" target="_blank" rel="noreferrer">
                          {it.label}
                        </a>
                      : <span className="text-dc-text">{it.label}</span>}
                      {it.note ? <span className="block text-xs text-dc-muted mt-0.5 ml-5">{it.note}</span> : null}
                    </li>
                  ))}
                </ol>
              </>,
              m.id
            )
          case 'contacts':
            return wrap(
              <OrgContactsBlock title={moduleTitle(m, 'Who to contact')} rows={m.rows} />,
              m.id
            )
          case 'announcements':
            return wrap(
              <OrgAnnouncementsBlock title={moduleTitle(m, 'Announcements')} items={m.items} />,
              m.id
            )
          case 'documents':
            return wrap(
              <OrgDocumentsBlock title={moduleTitle(m, 'Library')} items={m.items} />,
              m.id
            )
          case 'volunteer':
            return wrap(
              <OrgVolunteerBlock
                title={moduleTitle(m, 'Volunteer')}
                bodyHtml={m.bodyHtml}
                signupUrl={m.signupUrl}
              />,
              m.id
            )
          case 'featured_vendors':
            return wrap(
              <>
                <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
                  {moduleTitle(m, 'Featured partners')}
                </h2>
                <OrgFeaturedVendorsBlock orgSlug={orgSlug} maxItems={m.maxItems ?? 8} emptyMessage={m.emptyMessage} />
              </>,
              m.id
            )
          case 'featured_articles':
            return wrap(
              <>
                <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
                  {moduleTitle(m, 'Featured reading')}
                </h2>
                <OrgFeaturedArticlesBlock orgSlug={orgSlug} maxItems={m.maxItems ?? 8} emptyMessage={m.emptyMessage} />
              </>,
              m.id
            )
          case 'event_picks': {
            const max = m.maxItems ?? 4
            const pool =
              m.filter === 'beginner_friendly' ? upcomingSorted.filter((e) => beginnerFriendlyTitle(e.title)) : upcomingSorted
            const picks = pool.slice(0, max)
            return wrap(
              <>
                <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
                  {moduleTitle(m, m.filter === 'beginner_friendly' ? 'Good first events' : 'Coming up')}
                </h2>
                {m.noteHtml ?
                  <div
                    className="c2k-rich-html prose prose-invert prose-sm max-w-none text-dc-text-muted mb-3 prose-a:text-dc-accent"
                    dangerouslySetInnerHTML={{ __html: m.noteHtml }}
                  />
                : null}
                {picks.length === 0 ?
                  <p className="text-sm text-dc-muted">No matching upcoming events on the calendar yet.</p>
                : <ul className="space-y-2">
                    {picks.map((ev) => (
                      <li key={ev.id}>
                        <Link to={`/events/${ev.id}`} className="text-sm text-dc-accent hover:underline">
                          {ev.title}
                        </Link>
                        <p className="text-xs text-dc-muted">
                          {new Date(ev.startsAt).toLocaleString()}
                          {ev.location ? ` · ${ev.location}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                }
              </>,
              m.id
            )
          }
          case 'reporting':
            return wrap(
              <>
                <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
                  {moduleTitle(m, 'Safety & reporting')}
                </h2>
                <div
                  className="c2k-rich-html prose prose-invert prose-sm max-w-none text-dc-text-muted prose-a:text-dc-accent mb-4"
                  dangerouslySetInnerHTML={{ __html: m.introHtml }}
                />
                {m.policyHtml ?
                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm text-dc-accent">Moderation & transparency</summary>
                    <div
                      className="mt-2 c2k-rich-html prose prose-invert prose-sm max-w-none text-dc-muted prose-a:text-dc-accent"
                      dangerouslySetInnerHTML={{ __html: m.policyHtml }}
                    />
                  </details>
                : null}
                <div className="flex flex-wrap gap-2">
                  {m.reportUrl ?
                    <a
                      href={m.reportUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center px-4 rounded-xl border border-dc-border text-sm text-dc-text hover:bg-dc-elevated-muted"
                    >
                      External report form
                    </a>
                  : null}
                  {isAuthenticated && orgReportAction ? orgReportAction : null}
                  {isAuthenticated && platformEscalationReportAction ? platformEscalationReportAction : null}
                </div>
                {!isAuthenticated ?
                  <p className="text-xs text-dc-muted mt-3">
                    Log in to submit an in-app report to org moderators or to escalate to the platform moderation team.
                  </p>
                : null}
              </>,
              m.id
            )
          default:
            return null
        }
      })}
    </div>
  )
}
