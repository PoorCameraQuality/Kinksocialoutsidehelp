import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import MediaEpisodeList from '@/components/media/MediaEpisodeList'
import MediaOutboundBar from '@/components/media/MediaOutboundBar'
import ReportAction from '@/components/moderation/ReportAction'
import { mediaShowTarget } from '@/lib/moderation/report-targets'
import DetailTemplate from '@/components/templates/DetailTemplate'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import StatusBanner from '@/components/ui/StatusBanner'
import { DancecardPanelSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { BOOKMARK_OBJECT_MEDIA_SHOW, useApiBookmarks } from '@/hooks/useApiBookmarks'
import { useApiMediaShow } from '@/hooks/useApiMediaShows'

const mediaDetailShellClass = 'max-w-3xl py-6 sm:px-8 lg:py-6'

export default function MediaShowPage() {
  const params = useParams()
  const slug = params.slug as string | undefined
  const { isAuthenticated, isFallback, viewerUserId } = useAuth()
  const { status, show, episodes, error, reload } = useApiMediaShow(slug)
  const bookmarkApi = useApiBookmarks(Boolean(isAuthenticated && !isFallback))
  const saved =
    show && isAuthenticated && !isFallback ?
      bookmarkApi.isBookmarked(BOOKMARK_OBJECT_MEDIA_SHOW, show.id)
    : false

  const onToggleSave = useCallback(async () => {
    if (!show || !isAuthenticated || isFallback) return
    await bookmarkApi.toggleBookmark(BOOKMARK_OBJECT_MEDIA_SHOW, show.id)
  }, [bookmarkApi, isAuthenticated, isFallback, show])

  if (status === 'loading' || status === 'idle') {
    return (
      <div className={`mx-auto px-4 ${mediaDetailShellClass}`}>
        <DancecardPanelSkeleton lines={6} />
      </div>
    )
  }

  if (error || !show) {
    return (
      <div className={`mx-auto px-4 ${mediaDetailShellClass}`}>
        <Link to="/media" className="text-sm text-dc-accent hover:underline">
          ← Media
        </Link>
        <div className="mt-4">
          <LoadErrorBanner message={error ?? 'Not found'} onRetry={() => void reload()} />
        </div>
      </div>
    )
  }

  return (
    <DetailTemplate
      className={mediaDetailShellClass}
      hero={
        <>
          <Link to="/media" className="text-sm text-dc-accent hover:underline">
            ← Media
          </Link>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row">
            <div className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-dc-elevated-muted sm:h-48 sm:w-48">
              {show.coverImageUrl ?
                <img src={show.coverImageUrl} alt="" className="h-full w-full object-cover" />
              : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-2xl font-bold text-dc-text">{show.title}</h1>
                <div className="flex flex-wrap gap-2">
                  {isAuthenticated && !isFallback ?
                    <button
                      type="button"
                      onClick={() => void onToggleSave()}
                      disabled={bookmarkApi.bookmarkBusy}
                      className="rounded-lg border border-dc-border px-3 py-1.5 text-sm text-dc-text hover:border-dc-accent-border/50"
                    >
                      {saved ? 'Saved' : 'Save channel'}
                    </button>
                  : <Link to={buildLoginHref(`/media/${show.slug}`)} className="text-sm text-dc-accent hover:underline">
                      Sign in to save
                    </Link>
                  }
                  {isAuthenticated ?
                    (() => {
                      const target = mediaShowTarget(show.id)
                      return (
                        <ReportAction
                          variant="button"
                          targetType={target.targetType}
                          targetId={target.targetId}
                          targetLabel={show.title}
                          surface="media_show"
                          className="rounded-lg border border-dc-border px-3 py-1.5 text-sm text-dc-muted hover:border-dc-accent-border/50"
                        />
                      )
                    })()
                  : null}
                </div>
              </div>
              <p className="mt-1 text-sm text-dc-muted">
                <Link
                  to={`/presenters/${encodeURIComponent(show.ownerUsername)}`}
                  className="text-dc-accent hover:underline"
                >
                  @{show.ownerUsername}
                </Link>
                {show.ownerDisplayName ? ` · ${show.ownerDisplayName}` : ''}
              </p>
              {show.description ?
                <p className="mt-4 text-sm leading-relaxed text-dc-text-muted">{show.description}</p>
              : null}
            </div>
          </div>
        </>
      }
    >
      {show.contentWarnings.length > 0 ?
        <StatusBanner tone="warning" className="mt-0">
          Content warnings: {show.contentWarnings.join(', ')}
        </StatusBanner>
      : null}

      {show.publicationStatus === 'PUBLISHED' && show.listInMedia ? null
      : viewerUserId === show.ownerUserId ?
        <StatusBanner tone="info" className="mt-6">
          This channel is not listed in the public directory yet.{' '}
          {show.submittedAt ? 'It is pending moderator review.' : 'Submit it for review when your links are ready.'}
        </StatusBanner>
      : null}

      <div className="mt-6">
        <MediaOutboundBar show={show} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dc-text">Episodes & releases</h2>
        <p className="mt-1 text-xs text-dc-muted">Episode links open on external platforms. Not inside Kink Social.</p>
        <div className="mt-4">
          <MediaEpisodeList show={show} episodes={episodes} />
        </div>
      </section>
    </DetailTemplate>
  )
}
