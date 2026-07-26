import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ReportAction from '@/components/moderation/ReportAction'
import { mediaShowTarget } from '@/lib/moderation/report-targets'
import { useAuth } from '@/contexts/AuthContext'
import { BOOKMARK_OBJECT_MEDIA_SHOW, useApiBookmarks } from '@/hooks/useApiBookmarks'
import type { ApiMediaShowListItem } from '@/hooks/useApiMediaShows'
import {
  FORMAT_BADGE_LABEL,
  mediaPlatformIndicators,
  primaryOutboundUrl,
} from '@/lib/media-page-utils'

type Props = {
  show: ApiMediaShowListItem
  /** Compact layout for grids; default horizontal list card. */
  layout?: 'list' | 'compact'
}

export default function MediaChannelCard({ show, layout = 'list' }: Props) {
  const { isAuthenticated, isFallback } = useAuth()
  const bookmarkApi = useApiBookmarks(Boolean(isAuthenticated && !isFallback))
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const saved =
    isAuthenticated && !isFallback ? bookmarkApi.isBookmarked(BOOKMARK_OBJECT_MEDIA_SHOW, show.id) : false

  const platforms = mediaPlatformIndicators(show)
  const outbound = primaryOutboundUrl(show)
  const creator = show.ownerDisplayName?.trim() || show.ownerUsername
  const channelHref = `/media/${encodeURIComponent(show.slug)}`

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const onToggleSave = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!isAuthenticated || isFallback) return
      await bookmarkApi.toggleBookmark(BOOKMARK_OBJECT_MEDIA_SHOW, show.id)
    },
    [bookmarkApi, isAuthenticated, isFallback, show.id],
  )

  const isCompact = layout === 'compact'

  return (
    <>
      <article
        className={`relative rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)] transition-colors hover:border-dc-accent-border/40 ${
          isCompact ? 'p-4' : 'flex flex-col gap-4 p-4 sm:flex-row sm:items-start'
        }`}
      >
        <Link
          to={channelHref}
          className={`shrink-0 overflow-hidden rounded-xl bg-dc-elevated-muted ${isCompact ? 'mb-3 block aspect-[2/1] w-full' : 'h-24 w-24 sm:h-28 sm:w-28'}`}
        >
          {show.coverImageUrl ?
            <img src={show.coverImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          : <div className="flex h-full min-h-[6rem] w-full items-center justify-center text-dc-muted">
              <svg className="h-10 w-10 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
          }
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-dc-accent-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
              {FORMAT_BADGE_LABEL[show.mediaFormat] ?? show.mediaFormat}
            </span>
            {platforms.map((p) => (
              <span
                key={p.key}
                className="rounded-md border border-dc-border px-1.5 py-0.5 text-[10px] font-medium text-dc-muted"
              >
                {p.label}
              </span>
            ))}
          </div>

          <h2 className="mt-2 text-lg font-semibold text-dc-text">
            <Link to={channelHref} className="hover:text-dc-accent line-clamp-2">
              {show.title}
            </Link>
          </h2>

          <p className="mt-1 text-sm text-dc-text-muted">
            {creator}
            {show.ownerUsername !== creator ? ` · @${show.ownerUsername}` : ''}
          </p>

          {show.description ?
            <p className={`mt-2 text-sm text-dc-text-muted ${isCompact ? 'line-clamp-2' : 'line-clamp-3'}`}>
              {show.description}
            </p>
          : null}

          {show.tags.length > 0 ?
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {show.tags.slice(0, 5).map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-dc-border px-2 py-0.5 text-[10px] font-medium text-dc-muted"
                >
                  {tag}
                </li>
              ))}
            </ul>
          : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to={channelHref}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Open channel
            </Link>
            {outbound ?
              <a
                href={outbound}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-3 text-sm font-medium text-dc-text-muted hover:text-dc-accent"
              >
                External platform ↗
              </a>
            : null}
            {isAuthenticated && !isFallback ?
              <button
                type="button"
                onClick={(e) => void onToggleSave(e)}
                disabled={bookmarkApi.bookmarkBusy}
                className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-3 text-sm font-medium text-dc-text-muted hover:text-dc-text disabled:opacity-60"
              >
                {saved ? 'Saved' : 'Save'}
              </button>
            : null}
            <div className="relative ml-auto sm:ml-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-dc-border text-dc-text-muted hover:text-dc-text"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Channel options"
              >
                ···
              </button>
              {menuOpen ?
                <ul
                  role="menu"
                  className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-lg"
                >
                  {isAuthenticated ?
                    <li role="none" onClick={() => setMenuOpen(false)}>
                      <ReportAction
                        variant="menu-item"
                        targetType={mediaShowTarget(show.id).targetType}
                        targetId={mediaShowTarget(show.id).targetId}
                        targetLabel={show.title}
                        surface="media_show"
                        className="px-4 py-2 text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text"
                      />
                    </li>
                  : null}
                </ul>
              : null}
            </div>
          </div>
        </div>
      </article>
    </>
  )
}
