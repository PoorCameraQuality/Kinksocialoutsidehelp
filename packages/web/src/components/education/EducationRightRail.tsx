import { Link } from 'react-router-dom'

import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'
import type { ApiEducationArticle } from '@/lib/education-article-types'
import type { EducationProgressSnapshot } from '@/lib/education-progress-preview'
import type { EducationLearningPath } from '@/lib/education-discover-data'

type Props = {
  articleCount: number
  pathCount: number
  learningPaths?: EducationLearningPath[]
  spotlightArticles?: ApiEducationArticle[]
  progressSnapshot: EducationProgressSnapshot
  savedArticleCount: number | null
  bookmarksReady: boolean
  isAuthenticated: boolean
}

export default function EducationRightRail({
  articleCount,
  pathCount,
  learningPaths = [],
  spotlightArticles = [],
  progressSnapshot,
  savedArticleCount,
  bookmarksReady,
  isAuthenticated,
}: Props) {
  const { stats, resume } = progressSnapshot

  return (
    <aside className={railAsideClass} aria-label="Education discovery">
      <RailCard title="Hub snapshot">
        <dl className="grid grid-cols-2 gap-3 text-center text-xs">
          <div className="rounded-xl border border-dc-border bg-dc-surface-muted/40 px-2 py-3">
            <dt className="text-dc-muted">Articles</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-dc-text">{articleCount}</dd>
          </div>
          <div className="rounded-xl border border-dc-border bg-dc-surface-muted/40 px-2 py-3">
            <dt className="text-dc-muted">Paths</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-dc-text">{pathCount}</dd>
          </div>
        </dl>
      </RailCard>

      <RailCard title="Progress &amp; saved">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-dc-border bg-dc-surface-muted/30 px-2 py-2">
            <dt className="text-dc-muted">Paths active</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-dc-text">{stats.pathsInProgress}</dd>
          </div>
          <div className="rounded-lg border border-dc-border bg-dc-surface-muted/30 px-2 py-2">
            <dt className="text-dc-muted">Modules done</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-dc-text">{stats.modulesCompleted}</dd>
          </div>
          <div className="col-span-2 rounded-lg border border-dc-border bg-dc-surface-muted/30 px-2 py-2">
            <dt className="text-dc-muted">Saved articles</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-dc-text">
              {!isAuthenticated ?
                '—'
              : !bookmarksReady ?
                '…'
              : savedArticleCount ?? 0}
            </dd>
          </div>
        </dl>

        {resume ?
          <div className="edu-rail-resume">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">Continue</p>
            <p className="mt-1 text-sm font-medium text-dc-text">{resume.pathTitle}</p>
            <p className="text-xs text-dc-muted line-clamp-1">Next: {resume.moduleLabel}</p>
            <Link
              to={resume.href}
              className="mt-2 inline-flex text-xs font-semibold text-dc-accent hover:underline"
            >
              Resume · {resume.progressPercent}% →
            </Link>
          </div>
        : null}

        <ul className="mt-3 space-y-1.5 text-xs">
          <li>
            <Link to="/education?view=progress" className="font-medium text-dc-accent hover:underline">
              My progress
            </Link>
            <span className="text-dc-muted"> · path completion (preview until account sync)</span>
          </li>
          <li>
            <Link to="/saved" className="font-medium text-dc-accent hover:underline">
              Saved
            </Link>
            <span className="text-dc-muted">
              {' '}
              · bookmarks{' '}
              {isAuthenticated ?
                bookmarksReady ?
                  'sync to your account'
                : 'loading…'
              : 'after sign-in'}
            </span>
          </li>
          <li className="text-dc-muted">Educator follows · planned (same pattern as People follows)</li>
        </ul>
      </RailCard>

      {learningPaths.length > 0 ?
        <RailCard title="Start a path">
          <ul className="space-y-2 text-sm">
            {learningPaths.slice(0, 3).map((path) => (
              <li key={path.id}>
                <Link to={path.href} className="font-medium text-dc-text hover:text-dc-accent">
                  {path.title}
                </Link>
                <p className="text-xs text-dc-muted">
                  {path.modules.length} modules
                  {path.progressPercent > 0 ? ` · ${path.progressPercent}% started` : ''}
                </p>
              </li>
            ))}
          </ul>
        </RailCard>
      : null}

      {spotlightArticles.length > 0 ?
        <RailCard title="ECKE essentials">
          <ul className="space-y-2 text-sm">
            {spotlightArticles.map((article) => (
              <li key={article.id}>
                <Link
                  to={`/education/${encodeURIComponent(article.slug)}`}
                  className="text-dc-text-muted hover:text-dc-accent"
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </RailCard>
      : null}
    </aside>
  )
}
