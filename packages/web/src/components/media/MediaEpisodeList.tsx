import ReportAction from '@/components/moderation/ReportAction'
import { useAuth } from '@/contexts/AuthContext'
import type { ApiMediaEpisode, ApiMediaShow } from '@/hooks/useApiMediaShows'
import { mediaEpisodeTarget } from '@/lib/moderation/report-targets'

function episodeHref(ep: ApiMediaEpisode): string | null {
  if (ep.youtubeVideoUrl) return ep.youtubeVideoUrl
  if (ep.externalAudioUrl) return ep.externalAudioUrl
  if (ep.spotifyEpisodeUrl) return ep.spotifyEpisodeUrl
  if (ep.appleEpisodeUrl) return ep.appleEpisodeUrl
  if (ep.websiteUrl) return ep.websiteUrl
  return null
}

function actionLabel(show: ApiMediaShow, ep: ApiMediaEpisode): string {
  if (ep.youtubeVideoUrl || show.mediaFormat === 'video') return 'Watch'
  return 'Listen'
}

type Props = {
  show: ApiMediaShow
  episodes: ApiMediaEpisode[]
}

export default function MediaEpisodeList({ show, episodes }: Props) {
  const { isAuthenticated, isFallback } = useAuth()
  const canReport = Boolean(isAuthenticated && !isFallback)

  if (episodes.length === 0) {
    return (
      <p className="text-sm text-dc-muted">
        No episodes listed yet. Podcast feeds sync on a schedule after approval.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-dc-border rounded-2xl border border-dc-border bg-dc-elevated/30">
      {episodes.map((ep) => {
        const href = episodeHref(ep)
        const target = mediaEpisodeTarget(ep.id)
        const date =
          ep.publishedAt ?
            new Date(ep.publishedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : null
        return (
          <li key={ep.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-dc-text">{ep.title}</p>
              {ep.description ?
                <p className="mt-1 text-xs text-dc-muted line-clamp-2">{ep.description}</p>
              : null}
              {date ? <p className="mt-1 text-xs text-dc-muted">{date}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canReport ?
                <ReportAction
                  variant="button"
                  targetType={target.targetType}
                  targetId={target.targetId}
                  targetLabel="episode"
                  surface="media_episode"
                  className="rounded-lg border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-muted hover:text-dc-accent min-h-0"
                />
              : null}
              {href ?
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-accent hover:bg-dc-elevated"
                >
                  {actionLabel(show, ep)}
                </a>
              : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
