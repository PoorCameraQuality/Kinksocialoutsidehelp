import { Link } from 'react-router-dom'

import type { EducationHubStats } from '@/lib/education-discover-data'

type Props = {
  stats: EducationHubStats
  onBrowseTopics?: () => void
  /** Live article catalogue (signed-in API). Hides mock-only stat pills. */
  apiBacked?: boolean
}

export default function EducationDiscoverHero({ stats, onBrowseTopics, apiBacked = false }: Props) {
  return (
    <section className="edu-hero" aria-label="Education hub hero">
      <div className="edu-hero__backdrop bg-dc-surface-muted" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-dc-accent/15 via-dc-surface-muted to-violet-950/40" />
        <div className="absolute inset-0 bg-dc-surface/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-dc-surface via-dc-surface/92 to-dc-surface/78" />
        <div className="absolute inset-0 bg-gradient-to-t from-dc-surface via-dc-surface/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-dc-accent/10 via-transparent to-transparent" />
      </div>

      <div className="edu-hero__content">
        <p className="text-xs font-semibold uppercase tracking-widest text-dc-accent">Education Hub</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-dc-text sm:text-4xl">Learn. Practice. Grow.</h1>
        <p className="mt-1.5 max-w-xl text-sm text-dc-text-muted">
          User Submitted article, video walkthroughs, and self curated paths from other members.
          {stats.articles > 0 ?
            <span className="text-dc-muted"> · {stats.articles.toLocaleString()} articles</span>
          : null}
        </p>

        {!apiBacked ?
          <div className="mt-4 hidden grid-cols-3 gap-2 sm:grid sm:max-w-md">
            <div className="rounded-lg border border-dc-border bg-dc-elevated-solid/80 px-2.5 py-1.5 text-center">
              <p className="text-sm font-bold tabular-nums text-dc-text">{stats.videos}</p>
              <p className="text-[10px] uppercase tracking-wide text-dc-muted">Videos</p>
            </div>
            <div className="rounded-lg border border-dc-border bg-dc-elevated-solid/80 px-2.5 py-1.5 text-center">
              <p className="text-sm font-bold tabular-nums text-dc-text">{stats.educators}</p>
              <p className="text-[10px] uppercase tracking-wide text-dc-muted">Educators</p>
            </div>
          </div>
        : null}
        {apiBacked ?
          <p className="mt-2 max-w-lg text-[11px] leading-snug text-dc-text-muted">
            {stats.videos > 0 ?
              `${stats.videos.toLocaleString()} video workshops and channels · ${stats.educators} educators on hub.`
            : `${stats.educators} educators publishing on the hub.`}{' '}
            Article catalogue below is live.
          </p>
        : null}

        <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
          <Link
            to="/education?view=paths"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover sm:px-5"
          >
            Browse learning paths
          </Link>
          <button
            type="button"
            onClick={onBrowseTopics}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-accent-border bg-dc-elevated-solid/80 px-4 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted/40 sm:px-5"
          >
            Topics
          </button>
        </div>
      </div>
    </section>
  )
}
