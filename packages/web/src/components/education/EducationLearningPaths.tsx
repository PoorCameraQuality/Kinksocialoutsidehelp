import { Link } from 'react-router-dom'

import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'

import type { EducationLearningPath } from '@/lib/education-discover-data'

function LearningPathCard({ path }: { path: EducationLearningPath }) {
  const completed = path.modules.filter((m) => m.completed).length

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]">
      <div className="aspect-[16/9] w-full bg-dc-surface-muted">
        {path.imageUrl ?
          <img src={path.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        : <MediaSurfaceFallback variant="article" label={path.title} />}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold text-dc-text">{path.title}</h3>
        <ul className="mt-3 space-y-1.5" aria-label={`${path.title} modules`}>
          {path.modules.map((mod) => (
            <li key={mod.label} className="flex items-start gap-2 text-xs text-dc-text-muted">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  mod.completed ?
                    'border-dc-accent bg-dc-accent text-dc-accent-foreground'
                  : 'border-dc-border bg-dc-elevated-muted'
                }`}
                aria-hidden
              >
                {mod.completed ?
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                : null}
              </span>
              <span className={mod.completed ? 'text-dc-text' : undefined}>{mod.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-dc-muted">
            <span>
              {completed}/{path.modules.length} modules
            </span>
            <span>{path.progressPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-dc-elevated-muted">
            <div
              className="h-full rounded-full bg-dc-accent transition-[width]"
              style={{ width: `${path.progressPercent}%` }}
              role="progressbar"
              aria-valuenow={path.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${path.title} progress`}
            />
          </div>
        </div>
        <Link
          to={path.href}
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Continue path
        </Link>
      </div>
    </article>
  )
}

type Props = {
  paths: EducationLearningPath[]
  /** Hide section title when the page already has its own heading (e.g. paths view). */
  showTitle?: boolean
}

export default function EducationLearningPaths({ paths, showTitle = true }: Props) {
  if (paths.length === 0) return null

  return (
    <section className="mb-10" aria-label="Learning paths">
      {showTitle ?
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-dc-text">Learning paths</h2>
      : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {paths.map((path) => (
          <LearningPathCard key={path.id} path={path} />
        ))}
      </div>
    </section>
  )
}
