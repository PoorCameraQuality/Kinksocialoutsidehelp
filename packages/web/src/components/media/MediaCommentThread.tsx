import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import UserAvatar from '@/components/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useApiMediaComments } from '@/hooks/useApiMedia'
import { buildLoginHref } from '@/lib/auth-links'

type Props = {
  mediaItemId: string
  canComment: boolean
  initialCount?: number
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

export default function MediaCommentThread({ mediaItemId, canComment, initialCount = 0 }: Props) {
  const fieldId = useId()
  const { isAuthenticated } = useAuth()
  const { comments, status, error, submitting, postComment } = useApiMediaComments(mediaItemId)
  const [body, setBody] = useState('')

  const submit = async () => {
    const ok = await postComment(body)
    if (ok) setBody('')
  }

  return (
    <section className="space-y-4" aria-label="Comments">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-dc-text">Comments</h2>
        <span className="text-xs text-dc-muted tabular-nums">
          {comments.length || initialCount}
        </span>
      </div>

      {status === 'loading' ?
        <p className="text-sm text-dc-muted">Loading comments…</p>
      : null}
      {error ?
        <p className="text-sm text-dc-danger">{error}</p>
      : null}

      <ul className="space-y-3">
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-3">
            <UserAvatar size="sm" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-dc-muted">
                <Link
                  to={`/profile/${encodeURIComponent(comment.author.username)}`}
                  className="font-medium text-dc-accent hover:underline"
                >
                  {comment.author.displayName ?? comment.author.username}
                </Link>
                <span> · {formatWhen(comment.createdAt)}</span>
              </p>
              <p className="mt-1 text-sm text-dc-text whitespace-pre-wrap">{comment.body}</p>
            </div>
          </li>
        ))}
      </ul>

      {canComment ?
        isAuthenticated ?
          <div className="space-y-2">
            <label htmlFor={fieldId} className="sr-only">
              Add a comment
            </label>
            <textarea
              id={fieldId}
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment…"
              className="w-full resize-none rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text placeholder-dc-muted outline-none focus:border-dc-accent focus:ring-1 focus:ring-dc-accent"
            />
            <button
              type="button"
              disabled={!body.trim() || submitting}
              onClick={() => void submit()}
              className="rounded-lg bg-dc-accent px-3 py-2 text-sm font-medium text-dc-accent-foreground disabled:opacity-50"
            >
              {submitting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        : <p className="text-sm text-dc-muted">
            <Link to={buildLoginHref(window.location.pathname)} className="text-dc-accent hover:underline">
              Sign in
            </Link>{' '}
            to comment.
          </p>
      : <p className="text-sm text-dc-muted">Comments are closed for this media.</p>}
    </section>
  )
}
