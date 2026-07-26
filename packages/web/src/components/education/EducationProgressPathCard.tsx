import { Link } from 'react-router-dom'

import type { EducationLearningPath } from '@/lib/education-discover-data'

type Props = {
  path: EducationLearningPath
}

export default function EducationProgressPathCard({ path }: Props) {
  const completed = path.modules.filter((m) => m.completed).length
  const nextModule = path.modules.find((m) => !m.completed)

  return (
    <article className="edu-path-card">
      <div className="border-b border-dc-border/70 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">Learning path</p>
            <h3 className="mt-1 text-base font-semibold text-dc-text">{path.title}</h3>
          </div>
          <span className="shrink-0 rounded-full border border-dc-border bg-dc-elevated-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-dc-text">
            {path.progressPercent}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-dc-elevated-muted">
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
        <p className="mt-2 text-xs text-dc-muted">
          {completed}/{path.modules.length} modules complete
          {nextModule ? ` · Next: ${nextModule.label}` : ' · Path complete'}
        </p>
      </div>

      <ul className="flex-1 space-y-2 px-4 py-4" aria-label={`${path.title} modules`}>
        {path.modules.map((mod) => (
          <li key={mod.label} className="flex items-start gap-2.5 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                mod.completed ?
                  'border-dc-accent bg-dc-accent text-dc-accent-foreground'
                : 'border-dc-border bg-dc-elevated-muted text-transparent'
              }`}
              aria-hidden
            >
              {mod.completed ?
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              : null}
            </span>
            <span className={mod.completed ? 'text-dc-text line-through decoration-dc-border' : 'text-dc-text-muted'}>
              {mod.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-dc-border/70 p-4">
        <Link
          to={path.href}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          {path.progressPercent >= 100 ? 'Review path' : 'Continue path'}
        </Link>
      </div>
    </article>
  )
}
