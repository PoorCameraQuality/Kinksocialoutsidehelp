import { useState } from 'react'
import { Link } from 'react-router-dom'
import EducationArticleCard from '@/components/education/EducationArticleCard'
import EmptyState from '@/components/ui/EmptyState'
import TabButton from '@/components/ui/TabButton'
import type { ApiEducationArticle } from '@/lib/education-article-types'

const WRITING_SUBTABS = ['Articles', 'Journal', 'Education', 'Series'] as const
type WritingSubtab = (typeof WRITING_SUBTABS)[number]

function publicationStatusBadge(status: ApiEducationArticle['publicationStatus']) {
  if (status === 'PUBLISHED') return null
  const label = status === 'DRAFT' ? 'Draft' : 'Archived'
  return (
    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-dc-border text-dc-muted">
      {label}
    </span>
  )
}

type TeachingCredit = {
  id: string
  title: string
  eventName: string
  eventDate: string | null
  verified: boolean
  conventionSlug?: string | null
}

type Props = {
  viewerIsOwner: boolean
  loading: boolean
  unavailable: boolean
  articles: ApiEducationArticle[]
  teachingCredits?: TeachingCredit[]
  formatTeachingDate: (iso: string | null) => string
}

export default function ProfileWritingTab({
  viewerIsOwner,
  loading,
  unavailable,
  articles,
  teachingCredits = [],
  formatTeachingDate,
}: Props) {
  const [subtab, setSubtab] = useState<WritingSubtab>('Articles')

  const published = articles.filter((a) => a.publicationStatus === 'PUBLISHED')
  const drafts = articles.filter((a) => a.publicationStatus !== 'PUBLISHED')
  const listForSubtab =
    subtab === 'Articles' || subtab === 'Journal' ? (viewerIsOwner && subtab === 'Journal' ? drafts : published)
    : subtab === 'Education' ? published
    : published

  const publicHasWriting = published.length > 0 || teachingCredits.length > 0

  if (!viewerIsOwner && !publicHasWriting && !loading) {
    return (
      <EmptyState
        title="No published writing yet"
        message="This member has not published articles or education content yet."
        inline
        compact
        className="text-left"
      />
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div
        className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Writing sections"
      >
        {WRITING_SUBTABS.map((t) => (
          <TabButton key={t} label={t} isActive={subtab === t} onClick={() => setSubtab(t)} size="small" />
        ))}
      </div>

      {loading ?
        <p className="text-sm text-dc-muted">Loading writing…</p>
      : null}
      {unavailable ?
        <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Writing requires the API with <code className="text-amber-100">USE_DATABASE=true</code>.
        </p>
      : null}

      {subtab === 'Series' ?
        <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-text-muted">
          {viewerIsOwner ?
            <>
              Organize articles into series from{' '}
              <Link to="/education/series/manage" className="text-dc-accent hover:underline">
                Manage series
              </Link>
              .
            </>
          : 'No public series listed.'}
        </div>
      : null}

      {subtab !== 'Series' && !loading && listForSubtab.length === 0 ?
        viewerIsOwner ?
          <EmptyState
            message="Share guides, journal entries, and education content with the community."
            ctaLabel="Write an article"
            ctaHref="/education/write"
            secondaryCtaLabel="Start a journal entry"
            secondaryCtaHref="/education/write"
            inline
            compact
            className="text-left"
          />
        : <EmptyState title="No published writing yet" message="Published articles and journal entries appear here." inline compact className="text-left" />
      : null}

      {subtab !== 'Series' && listForSubtab.length > 0 ?
        <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {listForSubtab.map((article) => (
            <EducationArticleCard
              key={article.id}
              slug={article.slug}
              title={article.title}
              excerpt={article.excerpt}
              heroImageUrl={article.heroImageUrl}
              badge={viewerIsOwner ? publicationStatusBadge(article.publicationStatus) : null}
              subtitle={
                article.publishedAt ?
                  `Published ${new Date(article.publishedAt).toLocaleDateString()}`
                : `Updated ${new Date(article.updatedAt).toLocaleDateString()}`
              }
            />
          ))}
        </ul>
      : null}

      {viewerIsOwner && drafts.length > 0 && subtab !== 'Journal' ?
        <div className="rounded-xl border border-dc-border bg-dc-surface-muted/30 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-dc-muted mb-2">Drafts (private)</h4>
          <p className="text-xs text-dc-muted mb-2">{drafts.length} draft{drafts.length === 1 ? '' : 's'}. Only visible to you.</p>
          <Link to="/my-posts?tab=drafts" className="text-xs font-medium text-dc-accent hover:underline">
            View drafts
          </Link>
        </div>
      : null}

      {subtab === 'Education' && teachingCredits.length > 0 ?
        <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Teaching credits</h4>
          <ul className="space-y-2 text-sm">
            {teachingCredits.slice(0, 8).map((c) => (
              <li key={c.id} className="text-dc-text-muted">
                <span className="font-medium text-dc-text">{c.title}</span>
                <span className="text-dc-muted"> · {c.eventName}</span>
                {c.eventDate ? <span className="text-xs block">{formatTeachingDate(c.eventDate)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      : null}
    </div>
  )
}
