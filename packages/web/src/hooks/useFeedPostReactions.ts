import { emptyFeedReactionCounts, type FeedReactionId } from '@c2k/shared'
import { useCallback, useState } from 'react'

export type FeedReactionCounts = Record<FeedReactionId, number>

export function useFeedPostReactions(
  postId: string,
  initial: {
    reactionCounts?: FeedReactionCounts
    viewerReaction?: FeedReactionId | null
  },
) {
  const [reactionCounts, setReactionCounts] = useState<FeedReactionCounts>(
    initial.reactionCounts ?? emptyFeedReactionCounts(),
  )
  const [viewerReaction, setViewerReaction] = useState<FeedReactionId | null>(initial.viewerReaction ?? null)
  const [busy, setBusy] = useState(false)

  const applyPayload = useCallback(
    (data: { reactionCounts?: FeedReactionCounts; viewerReaction?: FeedReactionId | null }) => {
      if (data.reactionCounts) setReactionCounts(data.reactionCounts)
      if ('viewerReaction' in data) setViewerReaction(data.viewerReaction ?? null)
    },
    [],
  )

  const toggleReaction = useCallback(
    async (kind: FeedReactionId) => {
      if (busy) return
      setBusy(true)
      try {
        const isActive = viewerReaction === kind
        const method = isActive ? 'DELETE' : 'PUT'
        const r = await fetch(`/api/v1/feed/posts/${encodeURIComponent(postId)}/reactions`, {
          method,
          credentials: 'include',
          headers: method === 'PUT' ? { 'Content-Type': 'application/json' } : undefined,
          body: method === 'PUT' ? JSON.stringify({ kind }) : undefined,
        })
        if (!r.ok) return
        const data = (await r.json()) as {
          reactionCounts?: FeedReactionCounts
          viewerReaction?: FeedReactionId | null
        }
        applyPayload(data)
      } finally {
        setBusy(false)
      }
    },
    [applyPayload, busy, postId, viewerReaction],
  )

  return { reactionCounts, viewerReaction, busy, toggleReaction, setReactionCounts, setViewerReaction }
}
