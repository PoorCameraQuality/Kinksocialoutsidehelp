import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import EmptyState from '@/components/ui/EmptyState'
import TextInput from '@/components/ui/TextInput'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import type { ApiEducationArticle } from '@/hooks/useApiEducationArticles'
import { useApiEducationSeriesManageDetail } from '@/hooks/useApiEducationSeries'
import { useConfirm } from '@/hooks/useConfirm'

export default function EducationSeriesManageEditPage() {
  const { confirm, confirmDialog } = useConfirm()
  const { id } = useParams()
  const { viewerUserId, status: authStatus } = useAuth()
  const enabled = Boolean(viewerUserId && id)
  const { status, series, items, error, reload } = useApiEducationSeriesManageDetail(id, enabled)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [myArticles, setMyArticles] = useState<ApiEducationArticle[]>([])
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    if (!series) return
    setTitle(series.title)
    setSlug(series.slug)
    setDescription(series.description ?? '')
    setOrderedIds(items.map((i) => i.articleId))
  }, [series, items])

  useEffect(() => {
    if (!viewerUserId) return
    void (async () => {
      const r = await fetch('/api/v1/me/education-articles', { credentials: 'include' })
      if (!r.ok) return
      const data = (await r.json()) as { items?: ApiEducationArticle[] }
      setMyArticles(data.items ?? [])
    })()
  }, [viewerUserId])

  const saveMeta = useCallback(async () => {
    if (!id || !title.trim()) return
    setSaving(true)
    setBanner(null)
    try {
      const r = await fetch(`/api/v1/me/education-series/${encodeURIComponent(id)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
        }),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setBanner(j.error ?? 'Could not save series')
        return
      }
      setBanner('Series details saved.')
      reload()
    } finally {
      setSaving(false)
    }
  }, [id, title, slug, description, reload])

  const saveItems = useCallback(async () => {
    if (!id) return
    setSaving(true)
    setBanner(null)
    try {
      const r = await fetch(`/api/v1/me/education-series/${encodeURIComponent(id)}/items`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleIds: orderedIds }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setBanner(typeof j.error === 'string' ? j.error : 'Could not save article order')
        return
      }
      setBanner('Article order saved.')
      reload()
    } finally {
      setSaving(false)
    }
  }, [id, orderedIds, reload])

  const deleteSeries = useCallback(async () => {
    if (!id || !(await confirm('Delete this series?', 'Articles stay published; only the series grouping is removed.', { destructive: true }))) return
    const r = await fetch(`/api/v1/me/education-series/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (r.ok) window.location.href = '/education/series/manage'
  }, [id])

  const addArticle = (articleId: string) => {
    if (orderedIds.includes(articleId)) return
    setOrderedIds((prev) => [...prev, articleId])
  }

  const removeArticle = (articleId: string) => {
    setOrderedIds((prev) => prev.filter((x) => x !== articleId))
  }

  const moveArticle = (index: number, dir: -1 | 1) => {
    setOrderedIds((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      const tmp = next[index]!
      next[index] = next[target]!
      next[target] = tmp
      return next
    })
  }

  const articleById = (articleId: string) => myArticles.find((a) => a.id === articleId)

  const availableToAdd = myArticles.filter((a) => !orderedIds.includes(a.id))

  if (authStatus === 'ready' && !viewerUserId) {
    return <Navigate to={buildLoginHref(`/education/series/manage/${id ?? ''}`)} replace />
  }

  if (status === 'ready' && !series && !error) {
    return <Navigate to="/education/series/manage" replace />
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <Link to="/education/series/manage" className="text-sm text-dc-accent hover:underline">
        ← All series
      </Link>

      {error ?
        <EmptyState inline className="mt-6" title="Could not load series" message={error} actionLabel="Retry" onAction={reload} />
      : status === 'loading' || !series ?
        <div className="mt-6 h-32 animate-pulse rounded-2xl bg-dc-elevated-muted" aria-busy="true" />
      : <>
          <h1 className="mt-4 text-2xl font-bold text-dc-text">Edit series</h1>

          {banner ?
            <p className="mt-3 text-sm text-dc-text-muted">{banner}</p>
          : null}

          <section className="mt-6 space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/95 p-5">
            <h2 className="text-sm font-semibold uppercase text-dc-muted">Details</h2>
            <label className="block text-sm text-dc-text-muted">
              Title
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full" />
            </label>
            <label className="block text-sm text-dc-text-muted">
              URL slug
              <TextInput value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 w-full" />
            </label>
            <label className="block text-sm text-dc-text-muted">
              Description (optional)
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveMeta()}
              className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground disabled:opacity-60"
            >
              Save details
            </button>
          </section>

          <section className="mt-6 space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/95 p-5">
            <h2 className="text-sm font-semibold uppercase text-dc-muted">Parts (reading order)</h2>
            {orderedIds.length === 0 ?
              <p className="text-sm text-dc-text-muted">No articles in this series yet.</p>
            : <ol className="space-y-2">
                {orderedIds.map((articleId, index) => {
                  const a = articleById(articleId)
                  return (
                    <li
                      key={articleId}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-dc-accent w-6">{index + 1}</span>
                      <span className="min-w-0 flex-1 text-sm text-dc-text truncate">
                        {a?.title ?? articleId}
                        {a?.publicationStatus !== 'PUBLISHED' ?
                          <span className="ml-2 text-xs text-dc-muted">({a?.publicationStatus?.toLowerCase()})</span>
                        : null}
                      </span>
                      <button type="button" className="text-xs text-dc-muted hover:text-dc-text" onClick={() => moveArticle(index, -1)}>
                        Up
                      </button>
                      <button type="button" className="text-xs text-dc-muted hover:text-dc-text" onClick={() => moveArticle(index, 1)}>
                        Down
                      </button>
                      <button type="button" className="text-xs text-red-300 hover:underline" onClick={() => removeArticle(articleId)}>
                        Remove
                      </button>
                    </li>
                  )
                })}
              </ol>
            }

            {availableToAdd.length > 0 ?
              <div>
                <label className="block text-sm text-dc-text-muted mb-1">Add article</label>
                <select
                  className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addArticle(e.target.value)
                      e.target.value = ''
                    }
                  }}
                >
                  <option value="">Choose an article…</option>
                  {availableToAdd.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
            : null}

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveItems()}
              className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground disabled:opacity-60"
            >
              Save order
            </button>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={`/education/series/${encodeURIComponent(series.slug)}`}
              className="text-sm text-dc-accent hover:underline"
            >
              Preview series page →
            </Link>
            <button type="button" onClick={() => void deleteSeries()} className="text-sm text-red-300 hover:underline ml-auto">
              Delete series
            </button>
          </div>
        </>
      }
      {confirmDialog}
    </div>
  )
}
