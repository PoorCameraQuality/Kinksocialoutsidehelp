import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type FlagRow = {
  id: string
  targetUserId: string
  targetUsername: string
  kind: string
  status: string
  meta: Record<string, unknown>
  createdAt: string
}

export default function ModerationProfileFlagsPage() {
  const [items, setItems] = useState<FlagRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [noteById, setNoteById] = useState<Record<string, string>>({})

  const loadFlags = useCallback(async () => {
    setListLoading(true)
    try {
      const r = await fetch('/api/v1/moderation/profile-review-flags?status=OPEN', { credentials: 'include' })
      if (!r.ok) {
        setItems([])
        return
      }
      const data = (await r.json()) as { items: FlagRow[] }
      setItems(data.items ?? [])
    } catch {
      setItems([])
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFlags()
  }, [loadFlags])

  const closeFlag = async (id: string) => {
    setClosingId(id)
    try {
      const r = await fetch(`/api/v1/moderation/profile-review-flags/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CLOSED',
          note: noteById[id]?.trim() || undefined,
        }),
      })
      if (r.ok) await loadFlags()
    } finally {
      setClosingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Profile review flags</h2>
        <p className="text-sm text-dc-muted mt-1">
          Open cases from peer downvote surges and related trust signals. Close when reviewed. No automated enforcement.
        </p>
      </div>

      {listLoading ?
        <p className="text-dc-muted text-sm">Loading…</p>
      : items.length === 0 ?
        <p className="text-dc-muted text-sm">No open flags.</p>
      : (
        <ul className="space-y-4">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap gap-2 text-sm">
                <Link
                  to={`/profile/${encodeURIComponent(row.targetUsername)}`}
                  className="font-medium text-dc-text hover:underline"
                >
                  {row.targetUsername}
                </Link>
                <span className="text-dc-muted">{row.kind}</span>
                <span className="text-xs text-dc-muted">{new Date(row.createdAt).toLocaleString()}</span>
              </div>
              {row.meta && Object.keys(row.meta).length > 0 ?
                <pre className="text-xs text-dc-text-muted overflow-x-auto bg-dc-elevated-solid/50 rounded-lg p-2">
                  {JSON.stringify(row.meta, null, 2)}
                </pre>
              : null}
              <textarea
                value={noteById[row.id] ?? ''}
                onChange={(e) => setNoteById((m) => ({ ...m, [row.id]: e.target.value }))}
                placeholder="Optional moderator note (stored on flag meta)"
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-sm text-dc-text placeholder-dc-muted"
              />
              <button
                type="button"
                disabled={closingId === row.id}
                onClick={() => void closeFlag(row.id)}
                className="px-4 py-2 rounded-xl bg-dc-accent text-dc-accent-foreground text-sm font-medium disabled:opacity-50"
              >
                {closingId === row.id ? 'Closing…' : 'Mark reviewed (close)'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
