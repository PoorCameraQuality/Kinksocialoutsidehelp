import type { ApiMediaShow } from '@/hooks/useApiMediaShows'

type LinkItem = { label: string; href: string }

function collectLinks(show: ApiMediaShow): LinkItem[] {
  const links: LinkItem[] = []
  if (show.rssFeedUrl) links.push({ label: 'RSS feed', href: show.rssFeedUrl })
  if (show.applePodcastsUrl) links.push({ label: 'Apple Podcasts', href: show.applePodcastsUrl })
  if (show.spotifyShowUrl) links.push({ label: 'Spotify', href: show.spotifyShowUrl })
  if (show.youtubeChannelUrl) links.push({ label: 'YouTube channel', href: show.youtubeChannelUrl })
  if (show.youtubePlaylistUrl) links.push({ label: 'YouTube playlist', href: show.youtubePlaylistUrl })
  if (show.websiteUrl) links.push({ label: 'Website', href: show.websiteUrl })
  if (show.twitchUrl) links.push({ label: 'Twitch', href: show.twitchUrl })
  if (show.rumbleUrl) links.push({ label: 'Rumble', href: show.rumbleUrl })
  return links
}

type Props = {
  show: ApiMediaShow
}

export default function MediaOutboundBar({ show }: Props) {
  const links = collectLinks(show)
  if (links.length === 0) {
    return <p className="text-sm text-dc-muted">No outbound links on file for this channel.</p>
  }

  return (
    <div className="rounded-2xl border border-dc-accent-border/30 bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
      <h2 className="text-sm font-semibold text-dc-text">Open this creator on their external platforms</h2>
      <p className="mt-1 text-xs leading-relaxed text-dc-muted">
        Kink Social lists the channel and episode metadata only. Listening and watching happen on the platforms below. We do not
        host audio or video.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/50 hover:text-dc-accent"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
