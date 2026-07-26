import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import EducationProgressPathCard from '@/components/education/EducationProgressPathCard'
import EmptyState from '@/components/ui/EmptyState'
import type { ApiEducationArticle } from '@/lib/education-article-types'
import { buildProgressSnapshot, type EducationProgressActivity } from '@/lib/education-progress-preview'
import type { EducationLearningPath } from '@/lib/education-discover-data'

type Props = {
  paths: EducationLearningPath[]
  articles: ApiEducationArticle[]
  loading: boolean
}

function activityIcon(kind: EducationProgressActivity['kind']): string {
  if (kind === 'module') return '✓'
  if (kind === 'outline') return '📋'
  return '📄'
}

export default function EducationProgressPanel({ paths, articles, loading }: Props) {
  const snapshot = useMemo(() => buildProgressSnapshot(paths, articles), [paths, articles])

  return (
    <div className="space-y-8">
      <div className="edu-panel-intro">
        <p>
          Beta preview: progress below uses demo completion until account sync ships. Modules still link to live
          articles and series you can read now.
        </p>
        {!loading ?
          <dl className="edu-stat-grid">
            <div>
              <dt>In progress</dt>
              <dd>{snapshot.stats.pathsInProgress}</dd>
            </div>
            <div>
              <dt>Modules done</dt>
              <dd>{snapshot.stats.modulesCompleted}</dd>
            </div>
            <div>
              <dt>Articles touched</dt>
              <dd>{snapshot.stats.articlesEngaged}</dd>
            </div>
            <div>
              <dt>Weekly goal</dt>
              <dd>{snapshot.stats.weeklyGoalPercent}%</dd>
            </div>
          </dl>
        : null}
      </div>

      {loading ?
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="dc-skeleton-bone h-80 rounded-2xl" />
          ))}
        </div>
      : snapshot.paths.length === 0 ?
        <EmptyState
          inline
          title="No paths started yet"
          message="Pick a learning path to track modules here."
          ctaLabel="Browse learning paths"
          ctaHref="/education?view=paths"
        />
      : <>
          {snapshot.resume ?
            <section className="edu-block" aria-label="Resume learning">
              <div className="edu-resume-banner">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">Continue where you left off</p>
                  <h2 className="mt-1 text-xl font-semibold text-dc-text">{snapshot.resume.pathTitle}</h2>
                  <p className="mt-2 text-sm text-dc-text-muted">
                    Up next: <span className="font-medium text-dc-text">{snapshot.resume.moduleLabel}</span>
                  </p>
                  <div className="mt-4 max-w-xs">
                    <div className="mb-1 flex justify-between text-[11px] text-dc-muted">
                      <span>Path progress</span>
                      <span>{snapshot.resume.progressPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-dc-elevated-muted">
                      <div className="h-full rounded-full bg-dc-accent" style={{ width: `${snapshot.resume.progressPercent}%` }} />
                    </div>
                  </div>
                </div>
                <Link
                  to={snapshot.resume.href}
                  className="mt-4 inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover sm:mt-0"
                >
                  Resume module →
                </Link>
              </div>
            </section>
          : null}

          <section className="edu-block" aria-labelledby="progress-paths-heading">
            <div className="edu-block__head">
              <h2 id="progress-paths-heading" className="edu-block__title">
                Your learning paths
              </h2>
              <p className="edu-block__desc">Track module completion across curated sequences.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {snapshot.paths.map((path) => (
                <EducationProgressPathCard key={path.id} path={path} />
              ))}
            </div>
          </section>

          <section className="edu-block" aria-labelledby="progress-recent-heading">
            <div className="edu-block__head flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="progress-recent-heading" className="edu-block__title">
                  Recent activity
                </h2>
                <p className="edu-block__desc">Articles, modules, and outlines you engaged with recently.</p>
              </div>
              <Link to="/saved" className="text-sm font-medium text-dc-accent hover:underline">
                Open Saved →
              </Link>
            </div>
            <ul className="edu-activity-list">
              {snapshot.recent.map((item) => (
                <li key={item.id}>
                  <Link to={item.href}>
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dc-accent-muted text-sm"
                      aria-hidden
                    >
                      {activityIcon(item.kind)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">{item.category}</p>
                      <p className="mt-0.5 text-sm font-semibold text-dc-text">{item.title}</p>
                      <p className="mt-1 text-xs text-dc-muted">{item.activityLabel}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-dc-accent">Open</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <div className="edu-cta-banner border-dc-border bg-dc-elevated/80">
            <div>
              <p className="text-sm font-semibold text-dc-text">Weekly learning goal</p>
              <p className="mt-1 text-sm text-dc-text-muted">
                Complete 2 more modules this week to hit your preview goal. Account-backed streaks arrive in a later
                release.
              </p>
            </div>
            <Link
              to="/education?view=paths"
              className="mt-3 inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-dc-accent-border/50 px-4 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted/30 sm:mt-0"
            >
              Browse paths
            </Link>
          </div>
        </>
      }
    </div>
  )
}
