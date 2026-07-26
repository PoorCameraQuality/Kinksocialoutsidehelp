import { useState } from 'react'

type Props = {
  postsUrl: string
  canReply: boolean
  onSuccess: () => void
  className?: string
}

export default function ForumThreadReplyComposer({ postsUrl, canReply, onSuccess, className = '' }: Props) {
  const [replyBody, setReplyBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canReply) return null

  async function submit() {
    if (!replyBody.trim()) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(postsUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody.trim() }),
      })
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string }
        setError(typeof data.error === 'string' ? data.error : 'Could not post reply.')
        return
      }
      setReplyBody('')
      onSuccess()
    } catch {
      setError('Network error posting reply.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`shrink-0 border-t border-dc-border px-4 py-4 lg:px-6 ${className}`}>
      <label htmlFor="forum-reply-body" className="sr-only">
        Reply to thread
      </label>
      <textarea
        id="forum-reply-body"
        className="w-full rounded-lg border border-dc-border bg-black/30 px-3 py-2 text-sm text-dc-text"
        placeholder="Reply…"
        rows={3}
        value={replyBody}
        onChange={(e) => setReplyBody(e.target.value)}
        disabled={busy}
      />
      {error ?
        <p className="mt-2 text-xs text-red-300" role="alert">
          {error}
        </p>
      : null}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !replyBody.trim()}
        className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-dc-border px-4 text-sm font-medium text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
      >
        {busy ? 'Posting…' : 'Reply'}
      </button>
    </div>
  )
}
