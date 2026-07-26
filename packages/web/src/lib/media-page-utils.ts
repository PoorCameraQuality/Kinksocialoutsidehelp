import type { ApiMediaShowListItem, MediaFormat } from '@/hooks/useApiMediaShows'

export const MEDIA_FORMAT_TABS: { id: MediaFormat | ''; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'podcast', label: 'Podcasts' },
  { id: 'video', label: 'Video' },
  { id: 'hybrid', label: 'Hybrid' },
]

export const MEDIA_TOPIC_TAGS = [
  'Safety',
  'Rope',
  'Consent',
  'Education',
  'Events',
  'Community',
  'Interviews',
] as const

export type MediaTopicTag = (typeof MEDIA_TOPIC_TAGS)[number]

export const MEDIA_TOPIC_META: Record<MediaTopicTag, { icon: string; label: string }> = {
  Safety: { icon: '🛡️', label: 'Safety' },
  Rope: { icon: '🪢', label: 'Rope' },
  Consent: { icon: '🤝', label: 'Consent' },
  Education: { icon: '📚', label: 'Education' },
  Events: { icon: '📅', label: 'Events' },
  Community: { icon: '👥', label: 'Community' },
  Interviews: { icon: '🎙️', label: 'Interviews' },
}

export function formatMediaSubmittedAgo(iso: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const diffDays = Math.floor((Date.now() - t) / 86_400_000)
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 14) return `${diffDays} days ago`
  const weeks = Math.floor(diffDays / 7)
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
}

export const FORMAT_BADGE_LABEL: Record<MediaFormat, string> = {
  podcast: 'Podcast',
  video: 'Video',
  hybrid: 'Hybrid',
}

export type MediaPlatformKey = 'youtube' | 'spotify' | 'apple' | 'website' | 'rss'

export type MediaPlatformIndicator = { key: MediaPlatformKey; label: string }

export function mediaPlatformIndicators(
  show: Pick<
    ApiMediaShowListItem,
    | 'youtubeChannelUrl'
    | 'youtubePlaylistUrl'
    | 'spotifyShowUrl'
    | 'applePodcastsUrl'
    | 'websiteUrl'
    | 'rssFeedUrl'
  >,
): MediaPlatformIndicator[] {
  const out: MediaPlatformIndicator[] = []
  if (show.youtubeChannelUrl || show.youtubePlaylistUrl) out.push({ key: 'youtube', label: 'YouTube' })
  if (show.spotifyShowUrl) out.push({ key: 'spotify', label: 'Spotify' })
  if (show.applePodcastsUrl) out.push({ key: 'apple', label: 'Apple Podcasts' })
  if (show.websiteUrl) out.push({ key: 'website', label: 'Website' })
  if (show.rssFeedUrl) out.push({ key: 'rss', label: 'RSS' })
  return out
}

type OutboundFields = Pick<
  ApiMediaShowListItem,
  | 'mediaFormat'
  | 'youtubeChannelUrl'
  | 'youtubePlaylistUrl'
  | 'spotifyShowUrl'
  | 'applePodcastsUrl'
  | 'rssFeedUrl'
  | 'websiteUrl'
>

/** Best single outbound URL for opening the creator off-site. */
export function primaryOutboundUrl(show: OutboundFields): string | null {
  const yt = show.youtubeChannelUrl ?? show.youtubePlaylistUrl
  if (show.mediaFormat === 'video') {
    return yt ?? show.websiteUrl ?? show.rssFeedUrl ?? show.spotifyShowUrl ?? show.applePodcastsUrl ?? null
  }
  if (show.mediaFormat === 'podcast') {
    return show.spotifyShowUrl ?? show.applePodcastsUrl ?? show.rssFeedUrl ?? show.websiteUrl ?? yt ?? null
  }
  return yt ?? show.spotifyShowUrl ?? show.applePodcastsUrl ?? show.rssFeedUrl ?? show.websiteUrl ?? null
}

export function submissionStatusLabel(show: {
  publicationStatus: string
  listInMedia: boolean
  submittedAt: string | null
}): string {
  if (show.publicationStatus === 'PUBLISHED' && show.listInMedia) return 'Approved'
  if (show.submittedAt && show.publicationStatus !== 'PUBLISHED') return 'Pending review'
  if (show.publicationStatus === 'ARCHIVED') return 'Archived'
  return 'Draft. Not submitted'
}
