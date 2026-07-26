import { useEffect, useState } from 'react'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'

type AuditRow = {
  id: string
  verb: string
  scopeType: string
  scopeId: string | null
  targetType: string | null
  targetId: string | null
  createdAt: string
  payload: Record<string, unknown> | null
}

export default function ModerationAuditPage() {
  const { staff } = useApiPlatformStaff(true)
  const [items, setItems] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!staff?.moderator) return
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/v1/moderation/audit?limit=80', { credentials: 'include' })
        if (!r.ok || cancelled) return
        const data = (await r.json()) as { items?: AuditRow[] }
        if (!cancelled) setItems(data.items ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [staff?.moderator])

  if (!staff?.siteAdmin && !staff?.moderator) {
    return <p className="text-sm text-dc-muted">Moderator access required.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Audit log</h2>
        <p className="text-sm text-dc-muted mt-1">Append-only record of moderation activity across the platform.</p>
      </div>
      {loading ?
        <p className="text-sm text-dc-muted">Loading…</p>
      : items.length === 0 ?
        <p className="text-sm text-dc-muted">No events yet.</p>
      : (
        <ul className="space-y-2 max-h-[32rem] overflow-y-auto">
          {items.map((row) => (
            <li key={row.id} className="rounded-xl border border-dc-border px-3 py-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-dc-text">{row.verb}</span>
                <span className="text-dc-muted">{new Date(row.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-dc-muted mt-1">
                scope {row.scopeType}
                {row.scopeId ? ` · ${row.scopeId}` : ''}
                {row.targetType ? ` · ${row.targetType}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
