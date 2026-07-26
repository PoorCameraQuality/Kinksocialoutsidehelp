import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import CommunityTrustChip from '@/components/trust/CommunityTrustChip'

type IsoRow = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  body: string
  staffRemoved?: boolean
}

export default function ConventionAttendeeIsoMiniPanel({
  conventionKey,
  onOpenFullTab,
}: {
  conventionKey: string
  onOpenFullTab?: () => void
}) {
  const key = encodeURIComponent(conventionKey)
  const [items, setItems] = useState<IsoRow[]>([])
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/v1/conventions/${key}/iso-board`, { credentials: 'include' })
      if (!r.ok) {
        setItems([])
        setErr('Could not load ISO board.')
        return
      }
      const d = (await r.json()) as { boardEnabled: boolean; items: IsoRow[] }
      setEnabled(d.boardEnabled)
      setItems((d.items ?? []).filter((x) => !x.staffRemoved).slice(0, 6))
    } catch {
      setErr('Network error.')
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <p className="text-sm text-dc-muted">Loading ISO board…</p>
  if (err) return <p className="text-sm text-red-300">{err}</p>
  if (!enabled) return <p className="text-sm text-dc-muted">ISO board is off for this convention.</p>
  if (items.length === 0) return <p className="text-sm text-dc-muted">No ISO posts yet.</p>

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((entry) => (
          <li key={entry.userId} className="rounded-xl border border-dc-border p-3">
            <div className="flex items-center gap-2">
              <PlaceholderAvatar size="sm" className="rounded-full" />
              <div>
                <p className="text-sm font-medium text-dc-text">{entry.displayName ?? entry.username}</p>
                <p className="text-xs text-dc-muted">@{entry.username}</p>
                <CommunityTrustChip username={entry.username} />
              </div>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-dc-text-muted">{entry.body}</p>
          </li>
        ))}
      </ul>
      {onOpenFullTab ?
        <button type="button" className="text-sm font-medium text-dc-accent hover:underline" onClick={onOpenFullTab}>
          Open full ISO board tab →
        </button>
      : <Link to={`/conventions/${encodeURIComponent(conventionKey)}?tab=ISO`} className="text-sm font-medium text-dc-accent hover:underline">
          Open full ISO board tab →
        </Link>}
    </div>
  )
}
