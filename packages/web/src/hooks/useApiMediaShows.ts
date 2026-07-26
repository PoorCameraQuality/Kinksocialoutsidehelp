import { useCallback, useEffect, useState } from 'react'
import type { ApiListStatus } from '@/hooks/useApiEvents'

export type MediaFormat = 'podcast' | 'video' | 'hybrid'

export type ApiMediaShowListItem = {
  id: string
  slug: string
  title: string
  description: string | null
  coverImageUrl: string | null
  mediaFormat: MediaFormat
  tags: string[]
  contentWarnings: string[]
  ownerUsername: string
  ownerDisplayName: string | null
  updatedAt: string
  rssFeedUrl?: string | null
  youtubeChannelUrl?: string | null
  youtubePlaylistUrl?: string | null
  spotifyShowUrl?: string | null
  applePodcastsUrl?: string | null
  websiteUrl?: string | null
}

export type ApiMediaShow = ApiMediaShowListItem & {
  rssFeedUrl: string | null
  youtubeChannelUrl: string | null
  youtubePlaylistUrl: string | null
  spotifyShowUrl: string | null
  applePodcastsUrl: string | null
  websiteUrl: string | null
  twitchUrl: string | null
  rumbleUrl: string | null
  listInMedia: boolean
  publicationStatus: string
  submittedAt: string | null
  approvedAt: string | null
  lastEpisodeSyncedAt: string | null
  ownerUserId: string
  presenterProfileUserId: string | null
  organizationId: string | null
  groupId: string | null
  createdAt: string
}

export type ApiMediaEpisode = {
  id: string
  showId: string
  slug: string
  title: string
  description: string | null
  publishedAt: string | null
  durationSeconds: number | null
  externalAudioUrl: string | null
  youtubeVideoUrl: string | null
  spotifyEpisodeUrl: string | null
  appleEpisodeUrl: string | null
  websiteUrl: string | null
  createdAt: string
}

export type UseApiMediaShowsQuery = {
  q?: string
  tag?: string
  format?: MediaFormat | ''
  limit?: number
  enabled?: boolean
}

export function useApiMediaShows(query: UseApiMediaShowsQuery = {}) {
  const { q, tag, format, limit = 24, enabled = true } = query
  const [status, setStatus] = useState<ApiListStatus>('idle')
  const [items, setItems] = useState<ApiMediaShowListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setStatus('ready')
      setItems([])
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q?.trim()) params.set('q', q.trim())
      if (tag?.trim()) params.set('tag', tag.trim())
      if (format) params.set('format', format)
      params.set('limit', String(limit))
      const r = await fetch(`/api/v1/media/shows?${params}`, { credentials: 'include' })
      if (r.status === 503) {
        setStatus('error')
        setError('Media directory requires database mode.')
        setItems([])
        return
      }
      if (!r.ok) {
        setStatus('error')
        setError(`Could not load media (HTTP ${r.status}).`)
        setItems([])
        return
      }
      const data = (await r.json()) as { items?: ApiMediaShowListItem[]; nextCursor?: string | null }
      setItems(data.items ?? [])
      setNextCursor(data.nextCursor ?? null)
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading media.')
      setItems([])
    }
  }, [enabled, format, limit, q, tag])

  useEffect(() => {
    void reload()
  }, [reload])

  return { status, items, error, nextCursor, reload }
}

export function useApiMediaShow(slug: string | undefined) {
  const [status, setStatus] = useState<ApiListStatus>('idle')
  const [show, setShow] = useState<ApiMediaShow | null>(null)
  const [episodes, setEpisodes] = useState<ApiMediaEpisode[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!slug) {
      setStatus('ready')
      setShow(null)
      setEpisodes([])
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const [showRes, epRes] = await Promise.all([
        fetch(`/api/v1/media/shows/${encodeURIComponent(slug)}`, { credentials: 'include' }),
        fetch(`/api/v1/media/shows/${encodeURIComponent(slug)}/episodes`, { credentials: 'include' }),
      ])
      if (!showRes.ok) {
        setStatus('error')
        setError(showRes.status === 404 ? 'Channel not found.' : `Could not load channel (HTTP ${showRes.status}).`)
        setShow(null)
        setEpisodes([])
        return
      }
      const showData = (await showRes.json()) as { show?: ApiMediaShow }
      setShow(showData.show ?? null)
      if (epRes.ok) {
        const epData = (await epRes.json()) as { items?: ApiMediaEpisode[] }
        setEpisodes(epData.items ?? [])
      } else {
        setEpisodes([])
      }
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading channel.')
      setShow(null)
      setEpisodes([])
    }
  }, [slug])

  useEffect(() => {
    void reload()
  }, [reload])

  return { status, show, episodes, error, reload }
}
