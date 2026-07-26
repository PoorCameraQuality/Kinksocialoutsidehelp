import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  eventId: string
  canEdit: boolean
}

export default function EventMatchmakerSettingsSection({ eventId, canEdit }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [formSchemaJson, setFormSchemaJson] = useState('{}')
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const load = useCallback(async () => {
    setLoadState('loading')
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/matchmaker`, { credentials: 'include' })
      if (!r.ok) {
        setLoadState('error')
        setMsg('Could not load matchmaker settings.')
        return
      }
      const d = (await r.json()) as { settings?: { enabled?: boolean; formSchema?: Record<string, unknown> } }
      setEnabled(Boolean(d.settings?.enabled))
      setFormSchemaJson(JSON.stringify(d.settings?.formSchema ?? {}, null, 2))
      setLoadState('ready')
    } catch {
      setLoadState('error')
      setMsg('Network error loading matchmaker settings.')
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!canEdit) return
    let formSchema: Record<string, unknown>
    try {
      formSchema = JSON.parse(formSchemaJson) as Record<string, unknown>
    } catch {
      setMsg('Invalid JSON in form schema.')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/matchmaker/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, formSchema }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setMsg(j.error ?? 'Save failed.')
        return
      }
      setMsg(enabled ? 'Matchmaker enabled for attendees.' : 'Matchmaker disabled.')
      await load()
    } catch {
      setMsg('Network error saving settings.')
    } finally {
      setBusy(false)
    }
  }

  if (!canEdit) return null

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-dc-text uppercase tracking-wide">Event matchmaker</h3>
        <p className="mt-1 text-xs text-dc-muted">
          Let attendees opt in to a swipe-style deck on the public event page. Enable before promoting matchmaker to
          guests.
        </p>
      </div>

      {loadState === 'loading' ?
        <div className="h-12 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
      : null}

      {loadState === 'ready' ?
        <>
          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-dc-border bg-dc-surface-muted px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="text-sm text-dc-text">Enable matchmaker for this event</span>
          </label>

          <button
            type="button"
            className="text-xs text-dc-accent hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced form schema
          </button>

          {showAdvanced ?
            <label className="block text-xs text-dc-muted">
              Form schema (JSON)
              <textarea
                value={formSchemaJson}
                onChange={(e) => setFormSchemaJson(e.target.value)}
                rows={6}
                className="mt-1 w-full font-mono text-xs rounded-lg border border-dc-border bg-black/30 p-3 text-dc-text"
              />
            </label>
          : null}

          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save matchmaker settings'}
            </button>
            <Link
              to={`/events/${encodeURIComponent(eventId)}`}
              className="text-xs text-dc-muted hover:text-dc-accent"
            >
              View public event page
            </Link>
          </div>
        </>
      : null}

      {msg ? <p className="text-xs text-dc-muted" role="status">{msg}</p> : null}
    </section>
  )
}
