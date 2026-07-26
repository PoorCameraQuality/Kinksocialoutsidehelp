import { Link } from 'react-router-dom'
import { useEffect, useId, useState } from 'react'
import UserAvatar from '@/components/UserAvatar'
import ReportAction from '@/components/moderation/ReportAction'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { commentTarget } from '@/lib/moderation/report-targets'

export type FeedPostComment = {
  id: string
  postId: string
  authorId: string
  authorUsername: string
  authorAvatarUrl?: string | null
  body: string
  createdAt: string
}

type Props = {
  postId: string
  initialCount?: number
  compact?: boolean
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'Just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return d.toLocaleDateString()
}

export default function FeedPostDiscussion({ postId, initialCount = 0, compact = false }: Props) {
  const fieldId = useId()
  const { isAuthenticated, status, viewerUserId } = useAuth()
  const [items, setItems] = useState<FeedPostComment[]>([])
  const [commentCount, setCommentCount] = useState(initialCount)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/v1/feed/posts/${encodeURIComponent(postId)}/comments`, {
          credentials: 'include',
        })
        if (cancelled) return
        if (r.status === 503) {
          setError('Comments require database mode.')
          return
        }
        if (!r.ok) {
          setError('Could not load discussion.')
          return
        }
        const data = (await r.json()) as { items?: FeedPostComment[]; commentCount?: number }
        setItems(data.items ?? [])
        if (typeof data.commentCount === 'number') setCommentCount(data.commentCount)
      } catch {
        if (!cancelled) setError('Network error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [postId])

  const submitComment = async () => {
    const trimmed = body.trim()
    if (!trimmed || submitting || !isAuthenticated) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/v1/feed/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      })
      if (!r.ok) return
      const data = (await r.json()) as { comment?: FeedPostComment; commentCount?: number }
      if (data.comment) {
        setItems((prev) => [...prev, data.comment!])
        setBody('')
      }
      if (typeof data.commentCount === 'number') setCommentCount(data.commentCount)
    } finally {
      setSubmitting(false)
    }
  }

  const sectionClass = compact ?
    'mt-4 border-t border-dc-border pt-4'
  : 'mt-8 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 sm:p-5'

  return (
    <section id="discuss" className={sectionClass} aria-label="Discussion">
      <h2 className="text-sm font-semibold text-dc-text">
        Discussion
        {commentCount > 0 ?
          <span className="ml-2 font-normal text-dc-muted">({commentCount})</span>
        : null}
      </h2>

      {loading ?
        <p className="mt-3 text-sm text-dc-muted">Loading discussion…</p>
      : error ?
        <p className="mt-3 text-sm text-amber-200">{error}</p>
      : items.length === 0 ?
        <p className="mt-3 text-sm text-dc-text-muted">No comments yet. Start the conversation.</p>
      : (
          <ul className="mt-4 space-y-3">
            {items.map((comment) => (
              <li key={comment.id} className="flex gap-3 rounded-xl border border-dc-border/60 bg-dc-surface-muted/40 p-3">
                <UserAvatar avatarUrl={comment.authorAvatarUrl} alt="" size="sm" className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/profile/${encodeURIComponent(comment.authorUsername)}`}
                      className="text-sm font-semibold text-dc-text hover:text-dc-accent"
                    >
                      @{comment.authorUsername}
                    </Link>
                    <span className="text-xs text-dc-muted">{formatWhen(comment.createdAt)}</span>
                    {isAuthenticated && viewerUserId !== comment.authorId ?
                      (() => {
                        const target = commentTarget(comment.id)
                        return (
                          <ReportAction
                            variant="button"
                            targetType={target.targetType}
                            targetId={target.targetId}
                            targetLabel="comment"
                            surface="feed"
                            className="!min-h-7 !px-2 !text-[11px] !text-dc-muted/80 hover:!text-dc-muted ml-auto"
                          />
                        )
                      })()
                    : null}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-dc-text-muted">{comment.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

      {status === 'ready' && !isAuthenticated ?
        <p className="mt-4 text-sm text-dc-text-muted">
          <Link to={buildLoginHref(`/share/post/${postId}#discuss`)} className="font-semibold text-dc-accent hover:underline">
            Sign in
          </Link>{' '}
          to join the discussion.
        </p>
      : isAuthenticated ?
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submitComment()
          }}
        >
          <label htmlFor={fieldId} className="sr-only">
            Write a comment
          </label>
          <textarea
            id={fieldId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts…"
            maxLength={4000}
            rows={3}
            className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)]"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post comment'}
          </button>
        </form>
      : null}
    </section>
  )
}
