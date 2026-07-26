import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

type ContributorRow = {
  id: string
  kind: string
  label: string
  description: string | null
  vendorSlug: string | null
  username: string | null
}

type VendorSearchHit = {
  id: string
  slug: string
  displayName: string
}

type Props = {
  eventId: string
  canEdit: boolean
}

export default function EventContributorsPanel({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<ContributorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [vendorQuery, setVendorQuery] = useState('')
  const [vendorHits, setVendorHits] = useState<VendorSearchHit[]>([])
  const [selectedVendor, setSelectedVendor] = useState<VendorSearchHit | null>(null)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/contributors`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setItems([])
        return
      }
      const d = (await r.json()) as { items: ContributorRow[] }
      setItems(d.items ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const q = vendorQuery.trim()
    if (q.length < 2) {
      setVendorHits([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/v1/vendors?q=${encodeURIComponent(q)}`, { credentials: 'include' })
          if (!r.ok || cancelled) return
          const d = (await r.json()) as { items: VendorSearchHit[] }
          if (!cancelled) setVendorHits(d.items ?? [])
        } catch {
          if (!cancelled) setVendorHits([])
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [vendorQuery])

  useEffect(() => {
    if (selectedVendor && !label.trim()) {
      setLabel(selectedVendor.displayName)
    }
  }, [selectedVendor, label])

  async function addVendorContributor(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedVendor) {
      setErr('Select a vendor from search results.')
      return
    }
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/contributors`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'vendor',
          vendorProfileId: selectedVendor.id,
          label: label.trim() || selectedVendor.displayName,
          description: description.trim() || undefined,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Could not add vendor')
        return
      }
      setMsg('Vendor added to event.')
      setVendorQuery('')
      setVendorHits([])
      setSelectedVendor(null)
      setLabel('')
      setDescription('')
      await load()
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function removeContributor(contributorId: string) {
    if (!confirm('Remove this contributor from the event?')) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch(
        `/api/v1/events/${encodeURIComponent(eventId)}/contributors/${encodeURIComponent(contributorId)}`,
        { method: 'DELETE', credentials: 'include' },
      )
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Could not remove contributor')
        return
      }
      setMsg('Contributor removed.')
      await load()
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OrganizerPanel
      title="Partners & vendors"
      description="Vendors listed here appear on the public event page and convention Partners strip when this event is an anchor."
    >
      {loading ?
        <p className="text-sm text-dc-muted">Loading contributors…</p>
      : items.length > 0 ?
        <ul className="divide-y divide-dc-border rounded-lg border border-dc-border mb-4">
          {items.map((c) => (
            <li key={c.id} className="px-3 py-2 text-sm flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-dc-text font-medium">{c.label}</span>
                <span className="text-dc-muted ml-2 capitalize">{c.kind}</span>
                {c.vendorSlug ?
                  <Link
                    to={`/vendors/${encodeURIComponent(c.vendorSlug)}`}
                    className="ml-2 text-dc-accent hover:underline"
                  >
                    /vendors/{c.vendorSlug}
                  </Link>
                : null}
                {c.description ?
                  <p className="text-xs text-dc-muted mt-1">{c.description}</p>
                : null}
              </div>
              {canEdit ?
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeContributor(c.id)}
                  className="shrink-0 text-xs text-red-200 hover:text-red-100 disabled:opacity-50"
                >
                  Remove
                </button>
              : null}
            </li>
          ))}
        </ul>
      : (
        <p className="text-sm text-dc-muted mb-4">No contributors listed yet.</p>
      )}

      {canEdit ?
        <form onSubmit={addVendorContributor} className="space-y-3 border-t border-dc-border pt-4">
          <p className="text-xs text-dc-muted">Add a vendor from the marketplace directory.</p>
          <div>
            <label htmlFor="ec-vendor-q" className="block text-xs text-dc-muted mb-1">
              Search vendors
            </label>
            <input
              id="ec-vendor-q"
              value={vendorQuery}
              onChange={(e) => {
                setVendorQuery(e.target.value)
                setSelectedVendor(null)
              }}
              placeholder="Shop name or slug"
              className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            />
            {vendorHits.length > 0 && !selectedVendor ?
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-dc-border bg-dc-elevated-solid">
                {vendorHits.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVendor(v)
                        setVendorQuery(v.displayName)
                        setVendorHits([])
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-dc-surface-muted"
                    >
                      {v.displayName}
                      <span className="text-dc-muted ml-2">/{v.slug}</span>
                    </button>
                  </li>
                ))}
              </ul>
            : null}
            {selectedVendor ?
              <p className="text-xs text-emerald-300 mt-1">Selected: {selectedVendor.displayName}</p>
            : null}
          </div>
          <div>
            <label htmlFor="ec-label" className="block text-xs text-dc-muted mb-1">
              Label on event page
            </label>
            <input
              id="ec-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            />
          </div>
          <div>
            <label htmlFor="ec-desc" className="block text-xs text-dc-muted mb-1">
              Description (optional)
            </label>
            <input
              id="ec-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            />
          </div>
          {err ?
            <p className="text-sm text-red-200" role="alert">
              {err}
            </p>
          : null}
          {msg ?
            <p className="text-sm text-emerald-300" role="status">
              {msg}
            </p>
          : null}
          <button
            type="submit"
            disabled={busy || !selectedVendor}
            className="min-h-9 rounded-lg bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add vendor'}
          </button>
        </form>
      : null}
    </OrganizerPanel>
  )
}
