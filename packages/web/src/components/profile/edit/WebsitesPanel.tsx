import { useState } from 'react'
import { FormStatusMessage } from '@/components/ui/primitives/layout'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import { useProfileEdit } from '@/contexts/ProfileEditContext'

export default function WebsitesPanel() {
  const ctx = useProfileEdit()
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const hasDraft = url.trim().length > 0

  async function addLink() {
    setError(null)
    setSuccess(null)
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Enter a website URL first.')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/profile/me/links', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, label: label.trim() || null }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setError(data.error ?? 'Could not save link.')
        return
      }
      setUrl('')
      setLabel('')
      setAdding(false)
      setSuccess('Link saved.')
      await ctx.reloadLinks()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function removeLink(id: string) {
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      const r = await fetch(`/api/profile/me/links/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!r.ok) {
        setError('Could not remove link.')
        return
      }
      setSuccess('Link removed.')
      await ctx.reloadLinks()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-dc-text">Links</h3>
          <p className="mt-0.5 text-xs text-dc-muted">Websites and profiles shown on your public page.</p>
        </div>
        {!adding ?
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setError(null)
              setSuccess(null)
            }}
            className="min-h-10 rounded-lg border border-dc-border-subtle px-3 text-sm font-medium text-dc-text hover:border-dc-accent"
          >
            Add link
          </button>
        : null}
      </div>

      <ul className="divide-y divide-dc-border-subtle rounded-xl border border-dc-border-subtle bg-dc-elevated-solid/60">
        {ctx.links.length === 0 ?
          <li className="px-4 py-6 text-sm text-dc-muted">No links yet.</li>
        : ctx.links.map((link) => (
            <li key={link.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2 sm:px-4">
              <div className="min-w-0">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium text-dc-text hover:text-dc-accent"
                >
                  {link.label ?? link.url}
                </a>
                {link.label ?
                  <p className="truncate text-xs text-dc-muted">{link.url}</p>
                : null}
              </div>
              <button
                type="button"
                onClick={() => void removeLink(link.id)}
                disabled={saving}
                className="shrink-0 text-sm text-dc-danger hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
      </ul>

      {adding ?
        <ProfileStudioInsetCard className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-dc-text">New link</p>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setUrl('')
                setLabel('')
                setError(null)
              }}
              className="text-xs text-dc-muted hover:text-dc-text"
            >
              Cancel
            </button>
          </div>
          <input
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
              setSuccess(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addLink()
              }
            }}
            disabled={saving}
            className="w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm disabled:opacity-60"
            autoFocus
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addLink()
              }
            }}
            disabled={saving}
            className="w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm disabled:opacity-60"
          />
          {error ? <FormStatusMessage tone="warning">{error}</FormStatusMessage> : null}
          <button
            type="button"
            onClick={() => void addLink()}
            disabled={saving || !hasDraft}
            className="min-h-10 rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save link'}
          </button>
        </ProfileStudioInsetCard>
      : null}

      {success && !adding ? <FormStatusMessage tone="success">{success}</FormStatusMessage> : null}

      <p className="text-xs text-dc-muted">
        Presenter and vendor profiles are linked from those programs when you enroll.
      </p>
    </div>
  )
}
