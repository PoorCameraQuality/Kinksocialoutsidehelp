import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import EducationArticleCard from '@/components/education/EducationArticleCard'
import MediaChannelCard from '@/components/media/MediaChannelCard'
import ReportAction from '@/components/moderation/ReportAction'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import ScopePageMeta from '@/components/seo/ScopePageMeta'
import type { ApiMediaShowListItem } from '@/hooks/useApiMediaShows'
import type { ApiEducationArticle } from '@/lib/education-article-types'
import { useAuth } from '@/contexts/AuthContext'
import { useApiEducationSeriesByAuthor } from '@/hooks/useApiEducationSeries'
import { presenterTarget } from '@/lib/moderation/report-targets'
import PresenterBadges from '@/components/presenters/PresenterBadges'
import DetailTemplate from '@/components/templates/DetailTemplate'
import {
  formatPresenterRating,
  presenterFeedbackStatusLabel,
  presenterRoleLabel,
} from '@/lib/presenter-reputation-display'
import type { PresenterBadgeKey } from '@/lib/presenter-badges-types'
import type { ProfileFocus } from '@/lib/presenter-focus'
import { PRESENTER_MIN_REVIEWS_FOR_TIER } from '@c2k/shared'

const presenterDetailShellClass = 'max-w-3xl py-8 lg:py-8'

type RunnerMaterial = { label: string; url: string }

type Offering = {
  id: string
  title: string
  tease: string | null
  outline: string | null
  durationMinutes: number | null
  level: string | null
  format: string | null
  tags: string[] | null
  isPublic?: boolean
  runnerMaterials?: RunnerMaterial[]
}

type GalleryImage = {
  id: string
  imageUrl: string
  caption: string | null
  sortOrder: number
  createdAt: string
}

type TeachingCredit = {
  id: string
  title: string
  eventName: string
  eventDate: string | null
  detailUrl: string | null
  verified: boolean
  scheduleSlotId: string | null
  conventionSlug?: string | null
}

type SessionRow = {
  slotId: string
  startsAt: string
  endsAt: string
  title: string
  description: string | null
  location: string | null
  conventionSlug: string
  conventionName: string
  anchorEventId: string | null
}

type ReviewRow = {
  id: string
  rating: number
  body: string | null
  sourceKind: string
  createdAt: string
  authorUsername: string
  authorDisplayName: string | null
}

type PresenterDetail = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  pronouns: string | null
  badges?: PresenterBadgeKey[]
  verifiedTeachingCredits?: number
  profileFocuses?: ProfileFocus[]
  primaryProfileFocus?: ProfileFocus | null
  presenter: {
    headline: string | null
    bioShort: string | null
    bio: string | null
    links: Record<string, string>
    profileKind: string
    expertiseTags: string[] | null
    directoryVisibility: string
    ratingAvg: number
    reviewCount: number
  }
  offerings: Offering[]
  gallery: GalleryImage[]
  teachingCredits: TeachingCredit[]
  writingPreview: ApiEducationArticle[]
  viewerCanSeeRunnerMaterials: boolean
  sessions: SessionRow[]
  reviews: ReviewRow[]
}

function formatCreditDate(isoDate: string | null): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-').map((n) => Number(n))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate
  const [y, m, d] = parts
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString()
}

function normalizePresenterDetail(
  raw: PresenterDetail & { gallery?: unknown; teachingCredits?: unknown; writingPreview?: unknown },
): PresenterDetail {
  return {
    ...raw,
    gallery: Array.isArray(raw.gallery) ? raw.gallery : [],
    teachingCredits: Array.isArray(raw.teachingCredits) ? raw.teachingCredits : [],
    writingPreview: Array.isArray(raw.writingPreview) ? (raw.writingPreview as ApiEducationArticle[]) : [],
    viewerCanSeeRunnerMaterials: Boolean(raw.viewerCanSeeRunnerMaterials),
  }
}

export default function PresenterProfilePage() {
  const { username } = useParams()
  const [searchParams] = useSearchParams()
  const eventIdForReview = searchParams.get('eventId') ?? ''
  const { isAuthenticated, isFallback, viewerUsername } = useAuth()
  const [data, setData] = useState<PresenterDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewMsg, setReviewMsg] = useState<string | null>(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const authorSeries = useApiEducationSeriesByAuthor(username)
  const [mediaShows, setMediaShows] = useState<ApiMediaShowListItem[]>([])

  useEffect(() => {
    if (!username) return
    let cancelled = false
    void fetch(`/api/v1/presenters/${encodeURIComponent(username)}/media`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) return { items: [] as ApiMediaShowListItem[] }
        return (await r.json()) as { items?: ApiMediaShowListItem[] }
      })
      .then((j) => {
        if (!cancelled) setMediaShows(j.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setMediaShows([])
      })
    return () => {
      cancelled = true
    }
  }, [username])

  useEffect(() => {
    if (!username) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/v1/presenters/${encodeURIComponent(username)}`, { credentials: 'include' })
        const j = (await r.json()) as PresenterDetail & { error?: string }
        if (cancelled) return
        if (!r.ok) {
          setError(j.error ?? 'Not found')
          setData(null)
          return
        }
        setData(normalizePresenterDetail(j as PresenterDetail & { gallery?: unknown; teachingCredits?: unknown }))
      } catch {
        if (!cancelled) {
          setError('Network error')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [username])

  async function submitAttendeeReview() {
    if (!data || !eventIdForReview) {
      setReviewMsg('Add ?eventId=<uuid> to the URL (event where you saw this presenter).')
      return
    }
    setReviewMsg(null)
    setReviewSubmitting(true)
    try {
      const r = await fetch(`/api/v1/presenters/${data.userId}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: reviewRating,
          body: reviewBody.trim() || undefined,
          sourceKind: 'ATTENDEE',
          eventId: eventIdForReview,
        }),
      })
      const j = (await r.json()) as { error?: string }
      if (!r.ok) {
        setReviewMsg(j.error ?? 'Could not submit')
        return
      }
      setReviewMsg('Thanks. Your review was saved.')
      setReviewBody('')
      const r2 = await fetch(`/api/v1/presenters/${encodeURIComponent(username!)}`, { credentials: 'include' })
      if (r2.ok) {
        setData(normalizePresenterDetail((await r2.json()) as PresenterDetail & { gallery?: unknown; teachingCredits?: unknown }))
      }
    } catch {
      setReviewMsg('Network error')
    } finally {
      setReviewSubmitting(false)
    }
  }

  if (!username) return null

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-dc-muted text-sm">Loading…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-xl font-bold text-dc-text">Presenter</h1>
        <p className="text-dc-muted mt-2">{error ?? 'Not found'}</p>
        <Link to="/presenters" className="text-dc-accent text-sm mt-4 inline-block">
          Back to directory
        </Link>
      </div>
    )
  }

  const p = data.presenter
  const linkEntries = Object.entries(data.presenter.links || {}).filter(([, url]) => url?.trim())
  const roleLabel =
    presenterRoleLabel(p.profileKind, data.profileFocuses, data.primaryProfileFocus) ?? 'Community professional'
  const isAuthorProfile = p.profileKind === 'AUTHOR' || p.profileKind === 'BOTH' || data.profileFocuses?.includes('AUTHOR')

  const aboutSection =
    p.bioShort || p.bio ?
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">About</h2>
        {p.bioShort && <p className="text-dc-text-muted whitespace-pre-wrap">{p.bioShort}</p>}
        {p.bio && (
          <p className="text-dc-text-muted whitespace-pre-wrap mt-3 text-sm leading-relaxed">{p.bio}</p>
        )}
      </section>
    : null

  return (
    <>
      <ScopePageMeta
        title={`${data.displayName || data.username} — Professional profile`}
        description={p.headline ?? p.bioShort ?? undefined}
        path={`/presenters/${encodeURIComponent(data.username)}`}
        noIndex={p.directoryVisibility === 'UNLISTED'}
      />
      <DetailTemplate
        className={presenterDetailShellClass}
        hero={
          <>
            <Link to="/presenters" className="mb-6 inline-block text-sm text-dc-accent hover:underline">
              ← All presenters
            </Link>

            <header className="mt-2 flex flex-col gap-6 sm:flex-row">
              {data.avatarUrl ?
                <img
                  src={data.avatarUrl}
                  alt=""
                  className="h-28 w-28 shrink-0 rounded-2xl bg-dc-elevated-solid object-cover sm:h-32 sm:w-32"
                />
              : <PlaceholderAvatar size="xl" className="h-28 w-28 shrink-0 rounded-2xl sm:h-32 sm:w-32" />}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-dc-text">{data.displayName || data.username}</h1>
                {data.pronouns && <p className="mt-1 text-sm text-dc-muted">{data.pronouns}</p>}
                {p.headline && <p className="mt-2 text-dc-text-muted">{p.headline}</p>}
                <p className="mt-2 text-xs text-dc-muted">{roleLabel}</p>
                {data.badges && data.badges.length > 0 ?
                  <PresenterBadges badges={data.badges} className="mt-3" />
                : null}
                <p className="mt-2 text-xs text-dc-muted">
                  {presenterFeedbackStatusLabel(p.reviewCount) ??
                    (p.reviewCount >= PRESENTER_MIN_REVIEWS_FOR_TIER && p.ratingAvg > 0 ?
                      `${formatPresenterRating(p.ratingAvg, p.reviewCount)} from ${p.reviewCount} community review${p.reviewCount === 1 ? '' : 's'}`
                    : p.reviewCount > 0 ?
                      'Limited feedback'
                    : 'Limited feedback')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.expertiseTags?.map((t) => (
                    <span key={t} className="rounded-lg bg-dc-elevated-muted px-2 py-1 text-xs text-dc-text-muted">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to={`/profile/${encodeURIComponent(data.username)}`}
                    className="text-sm text-dc-accent hover:underline"
                  >
                    Social profile
                  </Link>
                  {isAuthenticated && !isFallback && viewerUsername !== data.username ?
                    (() => {
                      const target = presenterTarget(data.userId)
                      return (
                        <ReportAction
                          variant="button"
                          targetType={target.targetType}
                          targetId={target.targetId}
                          targetLabel="presenter"
                          surface="presenter_profile"
                          className="min-h-0 px-0 text-sm text-dc-muted hover:text-dc-accent"
                        />
                      )
                    })()
                  : null}
                </div>
              </div>
            </header>
          </>
        }
      >
      {linkEntries.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Links</h2>
          <ul className="flex flex-wrap gap-3">
            {linkEntries.map(([label, url]) => (
              <li key={label}>
                <a href={url} target="_blank" rel="noreferrer" className="text-sm text-dc-accent hover:underline">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAuthorProfile && aboutSection}

      {mediaShows.length > 0 && (
        <section id="media" className="mt-10">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Media</h2>
          <p className="mb-3 text-xs text-dc-muted">Podcasts and video channels. Listen and watch on external platforms.</p>
          <ul className="space-y-3">
            {mediaShows.map((show) => (
              <li key={show.id}>
                <MediaChannelCard show={show} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.writingPreview.length > 0 && (
        <section id="writing" className="mt-10">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Writing</h2>
          <ul className="space-y-3">
            {data.writingPreview.map((a) => (
              <EducationArticleCard
                key={a.id}
                slug={a.slug}
                title={a.title}
                excerpt={a.excerpt}
                heroImageUrl={a.heroImageUrl}
                subtitle={
                  a.readingMinutes != null ?
                    `${a.readingMinutes} min read`
                  : a.publishedAt ?
                    new Date(a.publishedAt).toLocaleDateString()
                  : null
                }
              />
            ))}
          </ul>
        </section>
      )}

      {authorSeries.items.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Series</h2>
          <ul className="space-y-3">
            {authorSeries.items.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/education/series/${encodeURIComponent(s.slug)}`}
                  className="block rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 hover:border-dc-accent-border/40"
                >
                  <p className="font-medium text-dc-text">{s.title}</p>
                  <p className="mt-1 text-xs text-dc-muted">
                    {s.partCount ?? s.itemCount ?? 0} part{(s.partCount ?? s.itemCount ?? 0) === 1 ? '' : 's'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isAuthorProfile && aboutSection}

      {data.gallery.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Gallery</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.gallery.map((g) => (
              <li key={g.id} className="rounded-xl overflow-hidden border border-dc-border bg-dc-elevated/95">
                <a href={g.imageUrl} target="_blank" rel="noreferrer noopener" className="block aspect-square bg-dc-elevated-solid">
                  <img
                    src={g.imageUrl}
                    alt={g.caption || ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                </a>
                {g.caption && <p className="text-xs text-dc-text-muted p-2">{g.caption}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.offerings.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Classes &amp; offerings</h2>
          {!data.viewerCanSeeRunnerMaterials && (
            <p className="text-xs text-dc-muted mb-4">
              Handouts and organizer-only links are not shown on this public page; they are visible to event organizers who
              work with this presenter on a program.
            </p>
          )}
          {data.viewerCanSeeRunnerMaterials && (
            <p className="text-xs text-amber-200/80 mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              You can see runner materials on this profile because you are staff for a convention this presenter is tied to,
              or an approved booking request exists.
            </p>
          )}
          <ul className="space-y-4">
            {data.offerings.map((o) => (
              <li key={o.id} className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-medium text-dc-text">{o.title}</p>
                  {data.viewerCanSeeRunnerMaterials && o.isPublic === false && (
                    <span className="text-[10px] uppercase tracking-wide text-dc-muted border border-dc-border rounded px-1.5 py-0.5">
                      Unlisted
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-dc-muted mt-1">
                  {o.format && <span>{o.format}</span>}
                  {o.level && <span>· {o.level}</span>}
                  {o.durationMinutes != null && <span>· {o.durationMinutes} min</span>}
                </div>
                {o.tease && <p className="text-sm text-dc-text-muted mt-2">{o.tease}</p>}
                {o.outline && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-dc-accent">Outline / what to expect</summary>
                    <p className="text-dc-muted mt-2 whitespace-pre-wrap">{o.outline}</p>
                  </details>
                )}
                {o.tags && o.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {o.tags.map((t) => (
                      <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-dc-elevated-muted text-dc-text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {data.viewerCanSeeRunnerMaterials && o.runnerMaterials && o.runnerMaterials.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-dc-border">
                    <p className="text-xs font-semibold text-amber-200/90 uppercase mb-2">Runner materials</p>
                    <ul className="space-y-1">
                      {o.runnerMaterials.map((m, i) => (
                        <li key={`${o.id}-${i}`}>
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-dc-accent hover:underline"
                          >
                            {m.label || m.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.teachingCredits.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Teaching history</h2>
          <p className="text-xs text-dc-muted mb-3">
            <span className="font-medium text-dc-text-muted">On program</span> entries are added from organizer program
            data after a session ends. Not a platform endorsement.{' '}
            <span className="font-medium text-dc-text-muted">Self-reported</span> entries are added by the presenter.
          </p>
          <ul className="space-y-3">
            {data.teachingCredits.map((c) => (
              <li key={c.id} className="rounded-xl border border-dc-border bg-dc-elevated-solid p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-dc-text font-medium">{c.title}</p>
                  {c.verified ?
                    <span
                      className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-dc-accent/40 text-dc-accent"
                      title="Listed in official program after the session ended"
                    >
                      On program
                    </span>
                  : <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-dc-border text-dc-muted">
                      Self-reported
                    </span>
                  }
                </div>
                <p className="text-dc-muted text-xs mt-1">
                  {c.verified ? `On program at ${c.eventName}` : c.eventName}
                  {c.eventDate ? ` · ${formatCreditDate(c.eventDate)}` : ''}
                </p>
                {c.conventionSlug ?
                  <Link
                    to={`/conventions/${encodeURIComponent(c.conventionSlug)}?tab=Schedule`}
                    className="text-dc-accent text-xs mt-1 inline-block hover:underline"
                  >
                    View convention program
                  </Link>
                : c.detailUrl ?
                  <a
                    href={c.detailUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-dc-accent text-xs mt-1 inline-block hover:underline"
                  >
                    Details
                  </a>
                : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.sessions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Scheduled sessions</h2>
          <ul className="space-y-3">
            {data.sessions.map((s) => (
              <li key={s.slotId} className="rounded-xl border border-dc-border bg-dc-elevated-solid p-3 text-sm">
                <p className="text-dc-text font-medium">{s.title}</p>
                <p className="text-dc-muted text-xs mt-1">
                  {new Date(s.startsAt).toLocaleString()} · {new Date(s.endsAt).toLocaleTimeString()}
                  {s.location ? ` · ${s.location}` : ''}
                </p>
                <Link
                  to={`/conventions/${encodeURIComponent(s.conventionSlug)}`}
                  className="text-dc-accent text-xs mt-1 inline-block hover:underline"
                >
                  {s.conventionName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.reviews.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Reviews</h2>
          <ul className="space-y-3">
            {data.reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-dc-border bg-dc-elevated/95 p-3 text-sm">
                <p className="text-dc-text">
                  <span className="text-dc-accent">★ {r.rating}</span>
                  <span className="text-dc-muted text-xs ml-2">
                    {r.sourceKind === 'ORGANIZATION' ? 'Organization' : 'Attendee'}
                  </span>
                </p>
                <p className="text-dc-muted text-xs mt-1">
                  {r.authorDisplayName || r.authorUsername} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
                {r.body && <p className="text-dc-text-muted mt-2">{r.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAuthenticated && !isFallback && data.username !== viewerUsername && eventIdForReview && (
        <section className="mt-10 rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
          <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">Leave a review</h2>
          <p className="text-xs text-dc-muted mb-3">Event: {eventIdForReview}</p>
          <label className="block text-sm text-dc-text-muted mb-1">Rating</label>
          <select
            value={reviewRating}
            onChange={(e) => setReviewRating(Number(e.target.value))}
            className="mb-3 w-full max-w-xs min-h-11 px-3 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <label className="block text-sm text-dc-text-muted mb-1">Comment (optional)</label>
          <textarea
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
          />
          <button
            type="button"
            disabled={reviewSubmitting}
            onClick={() => void submitAttendeeReview()}
            className="mt-3 px-4 py-2 rounded-xl bg-dc-accent text-dc-text text-sm font-medium disabled:opacity-50"
          >
            {reviewSubmitting ? 'Submitting…' : 'Submit attendee review'}
          </button>
          {reviewMsg && <p className="text-sm mt-2 text-dc-muted">{reviewMsg}</p>}
        </section>
      )}
      </DetailTemplate>
    </>
  )
}
