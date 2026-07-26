import { Link } from 'react-router-dom'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'
import type { ApiMediaShow } from '@/hooks/useApiMediaShows'
import {
  FORMAT_BADGE_LABEL,
  formatMediaSubmittedAgo,
  submissionStatusLabel,
} from '@/lib/media-page-utils'

function RecentSubmissionRow({ show, viewerUsername }: { show: ApiMediaShow; viewerUsername?: string }) {
  const ago = formatMediaSubmittedAgo(show.submittedAt ?? show.updatedAt)
  const byLine =
    viewerUsername ?
      `Submitted by you${ago ? ` · ${ago}` : ''}`
    : `Submitted by @${show.ownerUsername}${ago ? ` · ${ago}` : ''}`
  const status = submissionStatusLabel(show)
  const isPending = status === 'Pending review'

  return (
    <li className="flex gap-3 rounded-xl border border-dc-border/80 bg-dc-elevated-muted/40 p-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-dc-accent-muted text-dc-accent">
        {show.coverImageUrl ?
          <img src={show.coverImageUrl} alt="" className="h-full w-full object-cover" />
        : <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        }
      </div>
      <div className="min-w-0 flex-1">
        <Link
          to={`/media/${encodeURIComponent(show.slug)}`}
          className="text-sm font-semibold text-dc-text hover:text-dc-accent line-clamp-1"
        >
          {show.title}
        </Link>
        <p className="mt-0.5 text-[11px] text-dc-muted">{byLine}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {isPending ?
            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200/90">
              Pending review
            </span>
          : <span className="text-[10px] font-medium text-dc-muted">{status}</span>}
          <span className="rounded-md border border-dc-border px-1.5 py-0.5 text-[10px] font-medium text-dc-muted">
            {FORMAT_BADGE_LABEL[show.mediaFormat]}
          </span>
        </div>
      </div>
    </li>
  )
}

type Props = {
  myShows?: ApiMediaShow[]
  myShowsLoading?: boolean
  viewerUsername?: string
}

export default function MediaRightRail({ myShows = [], myShowsLoading, viewerUsername }: Props) {
  const recentSubmitted = [...myShows]
    .filter((s) => s.submittedAt)
    .sort((a, b) => {
      const ta = new Date(a.submittedAt ?? 0).getTime()
      const tb = new Date(b.submittedAt ?? 0).getTime()
      return tb - ta
    })
    .slice(0, 4)

  return (
    <aside className={railAsideClass} aria-label="Media directory tips">
      <RailCard
        title="What belongs here?"
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
            />
          </svg>
        }
      >
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Podcasts, YouTube channels, interview shows, educational series, and community media that are useful to Kink Social
          members.
        </p>
      </RailCard>

      <RailCard
        title="How submission works"
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        }
      >
        <ol className="space-y-2.5 text-xs text-dc-text-muted">
          <li className="flex gap-2">
            <span className="font-semibold text-dc-accent">1.</span>
            <span>Submit the channel with at least one listen or watch link.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-dc-accent">2.</span>
            <span>Kink Social reviews it for directory fit and content warnings.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-dc-accent">3.</span>
            <span className="inline-flex flex-wrap items-center gap-1">
              Approved channels appear in Media.
              <svg className="h-3.5 w-3.5 shrink-0 text-dc-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </span>
          </li>
        </ol>
      </RailCard>

      {myShowsLoading ?
        <RailCard title="Recently submitted">
          <p className="text-xs text-dc-muted">Loading…</p>
        </RailCard>
      : recentSubmitted.length > 0 ?
        <RailCard title="Recently submitted">
          <ul className="space-y-2">
            {recentSubmitted.map((show) => (
              <RecentSubmissionRow key={show.id} show={show} viewerUsername={viewerUsername} />
            ))}
          </ul>
          {myShows.length > recentSubmitted.length ?
            <Link to="/media/submit" className="mt-3 inline-flex text-xs font-medium text-dc-accent hover:underline">
              View all →
            </Link>
          : null}
        </RailCard>
      : null}

      <RailCard
        title="Looking for long-form writing?"
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        }
      >
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Deep dives, guides, and learning paths live in the Education hub. Separate from this link-out media directory.
        </p>
        <Link
          to="/education"
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-dc-accent-border/50 bg-dc-accent-muted/30 px-3 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted"
        >
          Open Education hub
          <span aria-hidden>→</span>
        </Link>
      </RailCard>
    </aside>
  )
}
