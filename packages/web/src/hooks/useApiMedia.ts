import { useCallback, useEffect, useState } from 'react'
import {
  emptyFeedReactionCounts,
  type FeedReactionId,
  type MediaAlbumSummary,
  type MediaCommentPolicy,
  type MediaItemSummary,
  type MediaKind,
  type MediaUploadAttestation,
  type MediaVisibility,
} from '@c2k/shared'
import type { FeedReactionCounts } from '@/hooks/useFeedPostReactions'

export type MediaItemDetail = {
  item: MediaItemSummary
  owner: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
  tags: string[]
  reactionCounts: FeedReactionCounts
  viewerReaction: FeedReactionId | null
  commentCount: number
  canEdit: boolean
  canDelete: boolean
  canComment: boolean
  canUseAsAvatar: boolean
  canReport: boolean
}

export type MediaComment = {
  id: string
  body: string
  author: { id: string; username: string; displayName: string | null }
  createdAt: string
}

export type MediaUploadItemInput = {
  quarantineKey?: string
  mediaAssetId?: string
  mediaKind: MediaKind
  originalFilename?: string
  mimeType: string
  sizeBytes: number
  imageWidth?: number
  imageHeight?: number
  videoWidth?: number
  videoHeight?: number
  durationSeconds?: number
  caption?: string
}

export type MediaUploadInput = {
  caption?: string
  items: MediaUploadItemInput[]
  visibility: MediaVisibility
  commentPolicy: MediaCommentPolicy
  postToFeed: boolean
  useAsAvatar?: boolean
  pinnedToProfile?: boolean
  tags?: string[]
  albumIds?: string[]
  attestation: MediaUploadAttestation
}

function normalizeReactionCounts(raw: Record<string, number> | undefined): FeedReactionCounts {
  const base = emptyFeedReactionCounts()
  if (!raw) return base
  for (const key of Object.keys(base) as FeedReactionId[]) {
    if (typeof raw[key] === 'number') base[key] = raw[key]
  }
  return base
}

function parseViewerReaction(raw: string | null | undefined): FeedReactionId | null {
  if (raw === 'love' || raw === 'respect' || raw === 'sympathize' || raw === 'helpful') return raw
  return null
}

export function useApiUserMedia(
  username: string | null,
  options: {
    enabled?: boolean
    kind?: 'image' | 'video' | 'all'
    tagged?: boolean
    album?: string
    limit?: number
  } = {},
) {
  const { enabled = true, kind = 'all', tagged = false, album, limit = 48 } = options
  const [items, setItems] = useState<MediaItemSummary[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled || !username) {
      setItems([])
      setNextCursor(null)
      setStatus('idle')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const params = new URLSearchParams({ kind, limit: String(limit) })
      if (tagged) params.set('tagged', 'true')
      if (album) params.set('album', album)
      const r = await fetch(
        `/api/v1/users/${encodeURIComponent(username)}/media?${params.toString()}`,
        { credentials: 'include' },
      )
      if (r.status === 503) {
        setError('Media gallery requires database mode.')
        setItems([])
        setStatus('error')
        return
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `HTTP ${r.status}`)
        setItems([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as { items?: MediaItemSummary[]; nextCursor?: string | null }
      setItems(data.items ?? [])
      setNextCursor(data.nextCursor ?? null)
      setStatus('ready')
    } catch {
      setError('Could not load media')
      setItems([])
      setStatus('error')
    }
  }, [album, enabled, kind, limit, tagged, username])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, nextCursor, status, error, reload }
}

export function useApiUserAlbums(username: string | null, enabled = true) {
  const [albums, setAlbums] = useState<MediaAlbumSummary[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled || !username) {
      setAlbums([])
      setStatus('idle')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch(`/api/v1/users/${encodeURIComponent(username)}/albums`, {
        credentials: 'include',
      })
      if (r.status === 503) {
        setError('Albums require database mode.')
        setAlbums([])
        setStatus('error')
        return
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `HTTP ${r.status}`)
        setAlbums([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as { albums?: MediaAlbumSummary[] }
      setAlbums(data.albums ?? [])
      setStatus('ready')
    } catch {
      setError('Could not load albums')
      setAlbums([])
      setStatus('error')
    }
  }, [enabled, username])

  useEffect(() => {
    void reload()
  }, [reload])

  return { albums, status, error, reload }
}

export function useApiMediaItemDetail(mediaItemId: string | null, enabled = true) {
  const [detail, setDetail] = useState<MediaItemDetail | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled || !mediaItemId) {
      setDetail(null)
      setStatus('idle')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch(`/api/v1/media/items/${encodeURIComponent(mediaItemId)}`, {
        credentials: 'include',
      })
      if (r.status === 404) {
        setError('Media not found')
        setDetail(null)
        setStatus('error')
        return
      }
      if (r.status === 503) {
        setError('Media detail requires database mode.')
        setDetail(null)
        setStatus('error')
        return
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `HTTP ${r.status}`)
        setDetail(null)
        setStatus('error')
        return
      }
      const data = (await r.json()) as {
        item: MediaItemSummary
        owner: MediaItemDetail['owner']
        tags?: string[]
        reactionCounts?: Record<string, number>
        viewerReaction?: string | null
        commentCount?: number
        canEdit?: boolean
        canDelete?: boolean
        canComment?: boolean
        canUseAsAvatar?: boolean
        canReport?: boolean
      }
      setDetail({
        item: data.item,
        owner: data.owner,
        tags: data.tags ?? [],
        reactionCounts: normalizeReactionCounts(data.reactionCounts),
        viewerReaction: parseViewerReaction(data.viewerReaction),
        commentCount: data.commentCount ?? 0,
        canEdit: data.canEdit ?? false,
        canDelete: data.canDelete ?? false,
        canComment: data.canComment ?? false,
        canUseAsAvatar: data.canUseAsAvatar ?? false,
        canReport: data.canReport ?? false,
      })
      setStatus('ready')
    } catch {
      setError('Could not load media')
      setDetail(null)
      setStatus('error')
    }
  }, [enabled, mediaItemId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { detail, status, error, reload, setDetail }
}

export function useApiMediaUpload() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (input: MediaUploadInput) => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/v1/me/media/uploads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = (await r.json().catch(() => ({}))) as {
        error?: string
        mediaItemIds?: string[]
        items?: MediaItemSummary[]
      }
      if (!r.ok) {
        const msg = data.error ?? `Upload failed (${r.status})`
        setError(msg)
        throw new Error(msg)
      }
      return data
    } finally {
      setBusy(false)
    }
  }, [])

  return { upload, busy, error }
}

export function useApiMediaReactions(
  mediaItemId: string,
  initial: { reactionCounts?: FeedReactionCounts; viewerReaction?: FeedReactionId | null },
) {
  const [reactionCounts, setReactionCounts] = useState<FeedReactionCounts>(
    initial.reactionCounts ?? emptyFeedReactionCounts(),
  )
  const [viewerReaction, setViewerReaction] = useState<FeedReactionId | null>(initial.viewerReaction ?? null)
  const [busy, setBusy] = useState(false)

  const toggleReaction = useCallback(
    async (kind: FeedReactionId) => {
      if (busy) return
      setBusy(true)
      try {
        const isActive = viewerReaction === kind
        if (isActive) {
          const r = await fetch(`/api/v1/media/items/${encodeURIComponent(mediaItemId)}/reactions`, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (!r.ok) return
          setViewerReaction(null)
          setReactionCounts((prev) => ({ ...prev, [kind]: Math.max(0, (prev[kind] ?? 0) - 1) }))
        } else {
          const prevKind = viewerReaction
          const r = await fetch(`/api/v1/media/items/${encodeURIComponent(mediaItemId)}/reactions`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind }),
          })
          if (!r.ok) return
          setViewerReaction(kind)
          setReactionCounts((prev) => {
            const next = { ...prev }
            if (prevKind) next[prevKind] = Math.max(0, (next[prevKind] ?? 0) - 1)
            next[kind] = (next[kind] ?? 0) + 1
            return next
          })
        }
      } finally {
        setBusy(false)
      }
    },
    [busy, mediaItemId, viewerReaction],
  )

  return {
    reactionCounts,
    viewerReaction,
    busy,
    setReactionCounts,
    setViewerReaction,
    toggleReaction,
  }
}

export function useApiMediaComments(mediaItemId: string, enabled = true) {
  const [comments, setComments] = useState<MediaComment[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const reload = useCallback(async () => {
    if (!enabled || !mediaItemId) {
      setComments([])
      setStatus('idle')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch(`/api/v1/media/items/${encodeURIComponent(mediaItemId)}/comments`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setError('Could not load comments')
        setComments([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as { comments?: MediaComment[] }
      setComments(data.comments ?? [])
      setStatus('ready')
    } catch {
      setError('Network error')
      setComments([])
      setStatus('error')
    }
  }, [enabled, mediaItemId])

  useEffect(() => {
    void reload()
  }, [reload])

  const postComment = useCallback(
    async (body: string) => {
      const trimmed = body.trim()
      if (!trimmed || submitting) return false
      setSubmitting(true)
      try {
        const r = await fetch(`/api/v1/media/items/${encodeURIComponent(mediaItemId)}/comments`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: trimmed }),
        })
        if (!r.ok) return false
        const data = (await r.json()) as { comment?: MediaComment }
        if (data.comment) setComments((prev) => [...prev, data.comment!])
        else void reload()
        return true
      } finally {
        setSubmitting(false)
      }
    },
    [mediaItemId, reload, submitting],
  )

  return { comments, status, error, submitting, reload, postComment }
}

export async function setMediaItemAsAvatar(mediaItemId: string): Promise<boolean> {
  const r = await fetch(`/api/v1/me/media/items/${encodeURIComponent(mediaItemId)}/use-as-avatar`, {
    method: 'POST',
    credentials: 'include',
  })
  return r.ok
}

export async function patchMediaItem(
  mediaItemId: string,
  patch: {
    caption?: string
    visibility?: MediaVisibility
    commentPolicy?: MediaCommentPolicy
    pinnedToProfile?: boolean
    showInFeed?: boolean
    tags?: string[]
    albumIds?: string[]
  },
): Promise<boolean> {
  const r = await fetch(`/api/v1/me/media/items/${encodeURIComponent(mediaItemId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return r.ok
}

export async function deleteMediaItem(mediaItemId: string): Promise<boolean> {
  const r = await fetch(`/api/v1/me/media/items/${encodeURIComponent(mediaItemId)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return r.ok
}

export type PendingPeopleTag = {
  id: string
  mediaItemId: string
  status: string
  label: string | null
  createdAt: string
  taggedBy: { id: string; username: string; displayName: string | null }
  mediaPreviewUrl: string | null
  mediaKind: MediaKind
}

export function useApiPendingPeopleTags(enabled = true) {
  const [tags, setTags] = useState<PendingPeopleTag[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setTags([])
      setStatus('idle')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch('/api/v1/me/media/people-tags/pending', { credentials: 'include' })
      if (r.status === 503) {
        setError('Tag inbox requires database mode.')
        setTags([])
        setStatus('error')
        return
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `HTTP ${r.status}`)
        setTags([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as { tags?: PendingPeopleTag[] }
      setTags(data.tags ?? [])
      setStatus('ready')
    } catch {
      setError('Could not load tag requests')
      setTags([])
      setStatus('error')
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { tags, status, error, reload, setTags }
}

export async function respondToPeopleTag(
  tagId: string,
  status: 'approved' | 'declined' | 'removed',
): Promise<boolean> {
  const r = await fetch(`/api/v1/media/people-tags/${encodeURIComponent(tagId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  return r.ok
}
