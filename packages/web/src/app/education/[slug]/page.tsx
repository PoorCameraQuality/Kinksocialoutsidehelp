import { useCallback } from 'react'
import ReportAction from '@/components/moderation/ReportAction'
import { educationArticleTarget } from '@/lib/moderation/report-targets'
import { Link, Navigate, useParams } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import EducationSeriesNav from '@/components/education/EducationSeriesNav'
import EmptyState from '@/components/ui/EmptyState'
import DetailTemplate from '@/components/templates/DetailTemplate'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import {
  BOOKMARK_OBJECT_EDUCATION_ARTICLE,
  useApiBookmarks,
} from '@/hooks/useApiBookmarks'
import { useApiEducationArticleBySlug } from '@/hooks/useApiEducationArticles'

const educationArticleShellClass = 'max-w-4xl py-6 lg:py-6'

export default function EducationArticlePage() {
  const { slug } = useParams()
  const { isAuthenticated, isFallback } = useAuth()

  const { status, article, linkedOfferings, seriesContext, error, reload } = useApiEducationArticleBySlug(slug)
  const bookmarkApi = useApiBookmarks(Boolean(isAuthenticated && !isFallback))

  const bodyHtmlSafe = typeof article?.bodyHtml === 'string' ? article.bodyHtml : ''

  const saved =
    article && isAuthenticated && !isFallback ?
      bookmarkApi.isBookmarked(BOOKMARK_OBJECT_EDUCATION_ARTICLE, article.id)
    : false

  const onToggleSave = useCallback(async () => {
    if (!article || !isAuthenticated || isFallback) return
    await bookmarkApi.toggleBookmark(BOOKMARK_OBJECT_EDUCATION_ARTICLE, article.id)
  }, [article, bookmarkApi, isAuthenticated, isFallback])

  if (!slug?.trim()) {
    return <Navigate to="/education" replace />
  }

  if (slug && status === 'ready' && !article && !error) {
    return <Navigate to="/education" replace />
  }

  const readLabel =
    article?.readingMinutes != null && article.readingMinutes >= 1 ?
      `${article.readingMinutes} min read`
    : null

  return (
    <DetailTemplate
      className={educationArticleShellClass}
      hero={
        <Link to="/education" className="inline-block text-sm text-dc-accent hover:underline">
          ← Back to Education
        </Link>
      }
    >
      {error ?
        <EmptyState
          inline
          className="rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
          title="Could not load article"
          message={error}
          actionLabel="Retry"
          onAction={reload}
          secondaryCtaLabel="Education hub"
          secondaryCtaHref="/education"
        />
      : status === 'loading' || status === 'idle' ?
        <div aria-busy="true" role="status" className="space-y-4">
          <div className="h-10 w-2/3 max-w-md animate-pulse rounded-xl bg-dc-elevated-muted" />
          <div className="h-56 animate-pulse rounded-2xl bg-dc-elevated-muted" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-dc-elevated-muted" />
            ))}
          </div>
        </div>
      : article ?
        <>
          <article className="min-w-0 max-w-full overflow-x-hidden">
            <header className="mb-6">
              <div className="mb-3 flex flex-wrap gap-2">
                {article.categories?.map((c) => (
                  <span key={c} className="inline-block rounded-md bg-dc-accent/20 px-2 py-0.5 text-xs font-medium text-dc-accent">
                    {c}
                  </span>
                ))}
              </div>
              <h1 className="mb-3 text-3xl font-bold text-dc-text">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-dc-muted">
                {readLabel ? <span>{readLabel}</span> : null}
                {article.difficulty ?
                  <span className="capitalize">· {article.difficulty}</span>
                : null}
              </div>
            </header>

            {seriesContext ?
              <EducationSeriesNav className="mb-6" context={seriesContext} />
            : null}

            {article.contentWarnings?.length ?
              <div
                role="alert"
                className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100/95"
              >
                <p className="text-sm font-semibold text-amber-200">Content considerations</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/90">
                  {article.contentWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            : null}

            <div className="mb-6 flex flex-wrap items-center gap-3">
              {!isAuthenticated || isFallback ?
                <Link
                  to={buildLoginHref()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:border-dc-accent-border hover:text-dc-text"
                >
                  Sign in to save
                </Link>
              : (
                <button
                  type="button"
                  onClick={() => void onToggleSave()}
                  disabled={bookmarkApi.bookmarkBusy}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60"
                >
                  {saved ? 'Saved' : bookmarkApi.bookmarkBusy ? 'Saving…' : 'Save'}
                </button>
              )}
              {article && isAuthenticated && !isFallback ?
                (() => {
                  const target = educationArticleTarget(article.id)
                  return (
                    <ReportAction
                      variant="button"
                      targetType={target.targetType}
                      targetId={target.targetId}
                      targetLabel="education article"
                      surface="education"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-muted hover:text-dc-accent"
                    />
                  )
                })()
              : null}
            </div>

            {article.heroImageUrl ?
              <div className="mb-8 max-w-full overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-muted">
                <img
                  src={article.heroImageUrl}
                  alt=""
                  className="mx-auto max-h-[min(420px,50vh)] max-w-full w-full object-contain"
                  decoding="async"
                />
              </div>
            : null}

            <div className="mb-10 min-w-0 max-w-full overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated/95 p-5 shadow-[var(--dc-shadow-soft)] sm:p-8">
              <div
                className="education-article-prose c2k-rich-html prose prose-invert max-w-none prose-headings:text-dc-text prose-p:text-dc-text-muted prose-li:text-dc-text-muted prose-a:text-dc-accent prose-strong:text-dc-text"
                dangerouslySetInnerHTML={{ __html: bodyHtmlSafe }}
              />
            </div>

            <aside className="mb-10 rounded-2xl border border-dc-border bg-dc-elevated/90 p-6 shadow-[var(--dc-shadow-soft)]">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-dc-muted">About the author</h2>
              <div className="flex items-start gap-3">
                <PlaceholderAvatar size="md" className="!rounded-full shrink-0" />
                <div className="min-w-0">
                  <Link
                    to={`/presenters/${encodeURIComponent(article.authorUsername)}`}
                    className="font-semibold text-dc-text hover:text-dc-accent"
                  >
                    {article.authorDisplayName?.trim() || article.authorUsername}
                  </Link>
                  <p className="mt-1 text-sm text-dc-text-muted">
                    @{article.authorUsername} · presenter profile →
                  </p>
                  <Link
                    to={`/profile/${encodeURIComponent(article.authorUsername)}`}
                    className="mt-2 inline-block text-xs text-dc-accent hover:underline"
                  >
                    Member profile
                  </Link>
                </div>
              </div>
            </aside>

            {linkedOfferings.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-3 text-lg font-semibold text-dc-text">Related classes & offerings</h2>
                <p className="mb-3 text-sm text-dc-text-muted">
                  Offerings tied to this article are listed by this educator on their presenter profile.
                </p>
                <ul className="space-y-2 rounded-2xl border border-dc-border bg-dc-elevated/80 px-4 py-3 shadow-[var(--dc-shadow-soft)]">
                  {linkedOfferings.map((o) => (
                    <li key={o.id} className="text-sm text-dc-text">
                      <span className="text-dc-text-muted">· </span>
                      <span>{o.title}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/presenters/${encodeURIComponent(article.authorUsername)}`}
                  className="mt-4 inline-flex text-sm font-medium text-dc-accent hover:underline"
                >
                  View on presenter profile →
                </Link>
              </section>
            )}
          </article>

          <footer className="rounded-2xl border border-dc-border bg-dc-elevated-muted/80 px-4 py-4 text-xs text-dc-text-muted">
            This resource is peer-educational only and reflects the author&apos;s experience and knowledge at the time of
            publishing. Nothing here is individualized medical or legal advice. Seek qualified professionals where
            appropriate. Kink Social does not certify techniques; organizers and readers are responsible
            for risk awareness, negotiation, consent, local law, venue rules, and their own competency.
          </footer>
        </>
      : null}
    </DetailTemplate>
  )
}
