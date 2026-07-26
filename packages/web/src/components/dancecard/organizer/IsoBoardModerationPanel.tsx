'use client'

/**
 * Organizer moderation for a convention **ISO board** (In Search Of posts), not platform ISO/legal.
 */
import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { Panel } from '@/components/dancecard/ui/Panel'
import { supportCopy } from '@/lib/dancecard/supportCopy'

type IsoPost = {
  id: string
  title: string
  visibility: string
  status: string
  curatedPin: boolean
  authorSceneName: string
  authorUsername: string
}

type IsoComment = {
  id: string
  postId: string
  body: string
  status: string
  authorName: string
  authorUsername: string | null
}

export function IsoBoardModerationPanel({ eventSlug, readOnly }: { eventSlug: string; readOnly: boolean }) {
  const [posts, setPosts] = useState<IsoPost[]>([])
  const [comments, setComments] = useState<IsoComment[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)

  const load = useCallback(async () => {
    setErr(null)
    setNeedsMigration(false)
    try {
      const [res, comm] = await Promise.all([
        organizerDancecardFetch<{ posts: IsoPost[]; needsMigration?: string }>(eventSlug, '/iso'),
        organizerDancecardFetch<{ comments: IsoComment[] }>(eventSlug, '/iso/comments').catch(() => ({
          comments: [],
        })),
      ])
      setPosts(res.posts ?? [])
      setComments(comm.comments ?? [])
      if (res.needsMigration) setNeedsMigration(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load ISO posts'
      if (msg.includes('migration') || msg.includes('049')) {
        setNeedsMigration(true)
      }
      setErr(msg)
      setPosts([])
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function patchPost(postId: string, patch: Record<string, unknown>) {
    if (readOnly) return
    setBusyId(postId)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, '/iso', {
        method: 'PATCH',
        body: JSON.stringify({ postId, ...patch }),
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg text-dc-text">ISO moderation</h3>
          <p className="text-xs text-dc-muted">Pin posts, hide from board, or mark filled / withdrawn.</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-muted hover:bg-dc-surface-muted"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {needsMigration ? (
        <p className="mb-3 text-sm text-dc-warning">{supportCopy.isoModerationNotReady}</p>
      ) : null}
      {err ? <p className="mb-3 text-sm text-dc-danger">{err}</p> : null}
      {!posts.length && !err ? <p className="text-sm text-dc-muted">No ISO posts yet.</p> : null}
      <ul className="space-y-2">
        {posts.map((p) => (
          <li key={p.id} className="rounded-xl border border-dc-border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-dc-text">{p.title}</p>
                <p className="text-xs text-dc-muted">
                  {p.authorSceneName}
                  {p.authorUsername ? ` (@${p.authorUsername})` : ''} · {p.visibility} · {p.status}
                  {p.curatedPin ? ' · pinned' : ''}
                </p>
              </div>
              {!readOnly ? (
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    className="rounded-lg border border-dc-border px-2 py-1 text-xs hover:bg-dc-surface-muted disabled:opacity-50"
                    onClick={() => void patchPost(p.id, { curatedPin: !p.curatedPin })}
                  >
                    {p.curatedPin ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    className="rounded-lg border border-dc-border px-2 py-1 text-xs hover:bg-dc-surface-muted disabled:opacity-50"
                    onClick={() =>
                      void patchPost(p.id, {
                        visibility: p.visibility === 'organizers_only' ? 'public' : 'organizers_only',
                      })
                    }
                  >
                    {p.visibility === 'organizers_only' ? 'Public' : 'Staff only'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    className="rounded-lg border border-dc-border px-2 py-1 text-xs hover:bg-dc-surface-muted disabled:opacity-50"
                    onClick={() => void patchPost(p.id, { status: 'filled' })}
                  >
                    Filled
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    className="rounded-lg border border-dc-border px-2 py-1 text-xs hover:bg-dc-surface-muted disabled:opacity-50"
                    onClick={() => void patchPost(p.id, { status: 'withdrawn' })}
                  >
                    Withdraw
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {comments.length > 0 ? (
        <div className="mt-6 border-t border-dc-border pt-4">
          <h4 className="text-sm font-semibold text-dc-text">Comments</h4>
          <ul className="mt-2 space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-dc-border px-3 py-2 text-xs">
                <p className="text-dc-muted">
                  {c.authorName}
                  {c.authorUsername ? ` @${c.authorUsername}` : ''} · {c.status}
                </p>
                <p className="mt-1 text-dc-text">{c.body}</p>
                {!readOnly && c.status !== 'hidden' ? (
                  <button
                    type="button"
                    className="mt-2 text-dc-accent hover:underline"
                    onClick={() =>
                      void organizerDancecardFetch(eventSlug, `/iso/comments/${c.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'hidden' }),
                      }).then(() => load())
                    }
                  >
                    Hide
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  )
}
