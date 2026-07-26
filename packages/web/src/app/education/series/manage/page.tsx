import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { useApiMyEducationSeries } from '@/hooks/useApiEducationSeries'

export default function EducationSeriesManagePage() {
  const { viewerUserId, status: authStatus } = useAuth()
  const { status, items, error, reload } = useApiMyEducationSeries(Boolean(viewerUserId))
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  if (authStatus === 'ready' && !viewerUserId) {
    return <Navigate to={buildLoginHref('/education/series/manage')} replace />
  }

  const handleCreate = () => {
    const title = window.prompt('Series title (e.g. Kink 101)')
    if (!title?.trim()) return
    void (async () => {
      setCreating(true)
      setCreateError(null)
      try {
        const r = await fetch('/api/v1/me/education-series', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim() }),
        })
        const data = (await r.json().catch(() => ({}))) as { series?: { id: string }; error?: string }
        if (!r.ok) {
          setCreateError(typeof data.error === 'string' ? data.error : 'Could not create series')
          return
        }
        if (data.series?.id) {
          window.location.href = `/education/series/manage/${encodeURIComponent(data.series.id)}`
        } else {
          reload()
        }
      } catch {
        setCreateError('Could not create series')
      } finally {
        setCreating(false)
      }
    })()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/education" className="text-sm text-dc-accent hover:underline">
            ← Education hub
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-dc-text">Article series</h1>
          <p className="mt-1 text-sm text-dc-text-muted">
            Group your articles in order · Kink 101, 102, 103. Without changing how each article is published.
          </p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={handleCreate}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60"
        >
          {creating ? 'Creating…' : 'New series'}
        </button>
      </div>

      {createError ?
        <p className="mb-4 text-sm text-red-300">{createError}</p>
      : null}

      {error ?
        <EmptyState
          inline
          title="Could not load series"
          message={error}
          actionLabel="Retry"
          onAction={reload}
        />
      : status === 'loading' || status === 'idle' ?
        <div className="space-y-3" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-dc-elevated-muted" />
          ))}
        </div>
      : items.length === 0 ?
        <EmptyState
          inline
          title="No series yet"
          message="Create a series to link articles in reading order."
          actionLabel="New series"
          onAction={handleCreate}
        />
      : <ul className="space-y-3">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dc-border bg-dc-elevated/95 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-dc-text">{s.title}</p>
                <p className="text-xs text-dc-muted mt-1">
                  {s.itemCount ?? 0} part{(s.itemCount ?? 0) === 1 ? '' : 's'} · /education/series/{s.slug}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/education/series/${encodeURIComponent(s.slug)}`}
                  className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
                >
                  View
                </Link>
                <Link
                  to={`/education/series/manage/${encodeURIComponent(s.id)}`}
                  className="inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-3 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      }
    </div>
  )
}
