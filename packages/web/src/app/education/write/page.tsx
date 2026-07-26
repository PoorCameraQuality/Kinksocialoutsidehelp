import type { JSONContent } from '@tiptap/core'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import EducationArticleEckePanel from '@/components/ecke/EducationArticleEckePanel'
import EducatorArticleEditor, { type EducatorArticleEditorHandle } from '@/components/editor/EducatorArticleEditor'
import Button from '@/components/ui/Button'
import StatusBanner from '@/components/ui/StatusBanner'
import TextInput from '@/components/ui/TextInput'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import type { ApiEducationArticle, EducationArticleVisibility } from '@/lib/education-article-types'
import { uploadEducationImage } from '@/lib/education-image-upload'
import { toggleArrayItem } from '@/lib/utils/toggleArrayItem'

export const EDUCATION_WRITE_CATEGORIES = [
  'Beginner',
  'Advanced',
  'Safety',
  'Psychology',
  'Gear',
  'Event Etiquette',
] as const

const CONTENT_WARNING_QUICK_TAGS = [
  'Explicit sexuality',
  'BDSM practice descriptions',
  'Emotional intensity',
  'Hypnosis/trance',
  'CNC / negotiation themes',
  'Edge play or risk discussion',
]

const DIFFICULTY_OPTIONS = ['', 'Beginner', 'Intermediate', 'Advanced'] as const

function isTipTapDoc(v: unknown): v is JSONContent {
  return Boolean(v && typeof v === 'object' && 'type' in v && (v as { type: unknown }).type === 'doc')
}

function articleToTipTapSeed(a: Pick<ApiEducationArticle, 'bodyJson' | 'bodyHtml'>): JSONContent | string | null {
  const j = a.bodyJson as unknown
  if (isTipTapDoc(j)) return j
  if (typeof a.bodyHtml === 'string' && a.bodyHtml.trim()) return a.bodyHtml
  return null
}

export default function EducationWritePage() {
  const slugId = useId()
  const titleId = useId()
  const excerptId = useId()

  const { viewerUserId, status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const articleId = params.id ?? searchParams.get('id')

  const editorRef = useRef<EducatorArticleEditorHandle>(null)

  const [loading, setLoading] = useState(Boolean(articleId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [customWarningDraft, setCustomWarningDraft] = useState('')
  const [difficulty, setDifficulty] = useState<string>('')
  const [visibility, setVisibility] = useState<EducationArticleVisibility>('PUBLIC')
  const [listInEducation, setListInEducation] = useState(false)
  const [eckePublish, setEckePublish] = useState(false)

  /** Last loaded article revision for editor hydration */
  const [editorSeed, setEditorSeed] = useState<JSONContent | string | null>(null)
  const [hydrationKey, setHydrationKey] = useState(0)

  const [heroUploading, setHeroUploading] = useState(false)

  const hydrateFromArticle = useCallback(
    (a: ApiEducationArticle, opts?: { resetBanner?: boolean; reloadEditor?: boolean }) => {
      setTitle(a.title)
      setSlug(a.slug)
      setExcerpt(a.excerpt ?? '')
      setHeroImageUrl(a.heroImageUrl ?? '')
      setCategories([...(a.categories ?? [])])
      setWarnings([...(a.contentWarnings ?? [])])
      setDifficulty(a.difficulty ?? '')
      setVisibility(a.visibility)
      setListInEducation(Boolean(a.listInEducation))
      setEckePublish(Boolean(a.eckePublish))
      if (opts?.reloadEditor) {
        setEditorSeed(articleToTipTapSeed(a))
        setHydrationKey((k) => k + 1)
      }
      if (opts?.resetBanner !== false) setBanner(null)
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!viewerUserId || !articleId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError(null)
      try {
        const r = await fetch('/api/v1/me/education-articles', { credentials: 'include' })
        if (r.status === 503) {
          setLoadError('Database mode is required to edit educator articles.')
          return
        }
        if (!r.ok) {
          setLoadError('Could not load your articles.')
          return
        }
        const data = (await r.json()) as { items?: ApiEducationArticle[] }
        const found = data.items?.find((x) => x.id === articleId)
        if (!found) {
          setLoadError('Article not found (or does not belong to you).')
          return
        }
        if (!cancelled) hydrateFromArticle(found, { reloadEditor: true })
      } catch {
        if (!cancelled) setLoadError('Network error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [articleId, viewerUserId, hydrateFromArticle])

  useEffect(() => {
    if (articleId) return
    setLoading(false)
    setLoadError(null)
    setTitle('')
    setSlug('')
    setExcerpt('')
    setHeroImageUrl('')
    setCategories([])
    setWarnings([])
    setDifficulty('')
    setVisibility('PUBLIC')
    setListInEducation(false)
    setEckePublish(false)
    setEditorSeed(null)
    setBanner(null)
    setHydrationKey((k) => k + 1)
  }, [articleId])

  const heroUpload = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setHeroUploading(true)
      setBanner(null)
      try {
        const url = await uploadEducationImage(file, 'hero')
        setHeroImageUrl(url)
      } catch (err) {
        setBanner({
          tone: 'error',
          text: err instanceof Error ? err.message : 'Hero image upload failed',
        })
      } finally {
        setHeroUploading(false)
      }
    }
    input.click()
  }, [])

  const save = async (publicationStatus: 'DRAFT' | 'PUBLISHED') => {
    const ed = editorRef.current
    if (!ed?.editor) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setBanner({ tone: 'error', text: 'Title is required.' })
      return
    }

    const listRequirements =
      listInEducation && (!categories.length || !warnings.length)
        ? 'At least one category and one content warning are required to list this article on the Education hub.'
        : null
    if (listRequirements) {
      setBanner({ tone: 'error', text: listRequirements })
      return
    }

    const { html: bodyHtml, json: bodyJson } = ed.getBody()
    const trimmedSlug = slug.trim()

    const payload = {
      title: trimmedTitle,
      slug: trimmedSlug || undefined,
      excerpt: excerpt.trim() || undefined,
      bodyHtml,
      bodyJson,
      heroImageUrl: heroImageUrl.trim() || null,
      categories: categories.length ? categories : undefined,
      difficulty: difficulty.trim() || null,
      contentWarnings: warnings.length ? warnings : undefined,
      visibility,
      listInEducation,
      eckePublish: publicationStatus === 'PUBLISHED' ? eckePublish : false,
      publicationStatus,
    }

    setSaving(true)
    setBanner(null)

    try {
      const url = articleId ? `/api/v1/me/education-articles/${articleId}` : '/api/v1/me/education-articles'
      const r = await fetch(url, {
        method: articleId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await r.json().catch(() => ({}))) as { article?: ApiEducationArticle; error?: string }

      if (r.status === 503) {
        setBanner({ tone: 'error', text: 'Database mode required.' })
        return
      }

      if (!r.ok || !data.article) {
        setBanner({
          tone: 'error',
          text: typeof data.error === 'string' ? data.error : `Save failed (${r.status})`,
        })
        return
      }

      setBanner({
        tone: 'success',
        text: publicationStatus === 'PUBLISHED' ? 'Article published.' : 'Draft saved.',
      })
      hydrateFromArticle(data.article, { resetBanner: false, reloadEditor: false })

      if (!articleId) {
        navigate(`/education/write/${encodeURIComponent(data.article.id)}`, { replace: true })
      }
    } catch {
      setBanner({ tone: 'error', text: 'Network error while saving.' })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-dc-muted">
        <p className="text-sm">Checking session…</p>
      </div>
    )
  }

  if (!viewerUserId) {
    return <Navigate to={buildLoginHref(location.pathname + location.search)} replace />
  }

  const initialDocSeed = typeof editorSeed === 'object' ? editorSeed : null
  const initialHtmlSeed = typeof editorSeed === 'string' ? editorSeed : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/education" className="text-sm text-dc-accent hover:underline mb-3 inline-block">
            ← Education hub
          </Link>
          <h1 className="text-2xl font-bold text-dc-text">
            {articleId ? 'Edit educator article' : 'Write educator article'}
          </h1>
          <p className="mt-2 text-sm text-dc-muted">Long-form guides for learners. Drafts stay private except to you.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link to="/education/write" className="text-xs text-dc-accent hover:underline whitespace-nowrap">
            + New article
          </Link>
          <Link to="/education/series/manage" className="text-xs text-dc-accent hover:underline whitespace-nowrap">
            Manage series
          </Link>
        </div>
      </div>

      {loading ? <StatusBanner tone="info">Loading article…</StatusBanner> : null}
      {loadError ? <StatusBanner tone="warning">{loadError}</StatusBanner> : null}
      {banner && !loading && !loadError ? <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner> : null}

      {!loadError && !loading ?
        <>
          <div className="mt-6 space-y-6 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)]">
            <div>
              <label htmlFor={titleId} className="block text-xs font-medium text-dc-text-muted mb-1">
                Title <span className="text-dc-danger">*</span>
              </label>
              <TextInput id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            </div>

            <div>
              <label htmlFor={slugId} className="block text-xs font-medium text-dc-text-muted mb-1">
                Slug URL (optional)
              </label>
              <TextInput
                id={slugId}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated when empty"
              />
              <p className="mt-1 text-[11px] text-dc-muted">Used at /education/your-slug when published publicly.</p>
            </div>

            <div>
              <label htmlFor={excerptId} className="block text-xs font-medium text-dc-text-muted mb-1">
                Short excerpt
              </label>
              <textarea
                id={excerptId}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                placeholder="Brief summary shown in previews"
                className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)]"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-dc-text-muted mb-2">Hero image</span>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="ghost" disabled={heroUploading} onClick={() => void heroUpload()}>
                  {heroUploading ? 'Uploading…' : 'Upload image'}
                </Button>
                {heroImageUrl ?
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-dc-muted"
                    onClick={() => setHeroImageUrl('')}
                  >
                    Clear
                  </Button>
                : null}
              </div>
              {heroImageUrl ?
                <img
                  src={heroImageUrl}
                  alt=""
                  className="mt-3 max-h-44 w-auto rounded-xl border border-dc-border bg-dc-surface-muted object-cover"
                />
              : null}
            </div>

            <div>
              <span className="block text-xs font-medium text-dc-text-muted mb-2">Categories</span>
              <div className="flex flex-wrap gap-2">
                {EDUCATION_WRITE_CATEGORIES.map((c) => {
                  const selected = categories.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      role="switch"
                      aria-checked={selected}
                      onClick={() => setCategories((prev) => toggleArrayItem(prev, c))}
                      className={`min-h-9 rounded-full border px-3 text-xs font-medium transition ${
                        selected ?
                          'border-dc-accent bg-dc-accent/15 text-dc-text'
                        : 'border-dc-border text-dc-text-muted hover:text-dc-text'
                      }`}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-dc-text-muted mb-2">Content warnings</span>
              <p className="text-[11px] text-dc-muted mb-2">
                Required alongside categories when listing on the hub. Add custom tags below.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {CONTENT_WARNING_QUICK_TAGS.map((w) => {
                  const selected = warnings.includes(w)
                  return (
                    <button
                      key={w}
                      type="button"
                      role="switch"
                      aria-checked={selected}
                      onClick={() => setWarnings((prev) => toggleArrayItem(prev, w))}
                      className={`min-h-9 rounded-full border px-3 text-[11px] font-medium transition ${
                        selected ?
                          'border-dc-warning/50 bg-dc-warning-muted text-dc-text'
                        : 'border-dc-border text-dc-text-muted hover:text-dc-text'
                      }`}
                    >
                      {w}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[140px]">
                  <label className="sr-only" htmlFor="cw-custom">
                    Add custom warning tag
                  </label>
                  <TextInput
                    id="cw-custom"
                    type="text"
                    value={customWarningDraft}
                    onChange={(e) => setCustomWarningDraft(e.target.value)}
                    placeholder="Custom warning (press Add)"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const t = customWarningDraft.trim()
                    if (!t || warnings.includes(t)) return
                    setWarnings((w) => [...w, t].slice(0, 16))
                    setCustomWarningDraft('')
                  }}
                  disabled={!customWarningDraft.trim()}
                >
                  Add
                </Button>
              </div>
              {warnings.length > 0 ?
                <ul className="mt-2 flex flex-wrap gap-2 text-[11px] text-dc-muted">
                  {warnings.map((w) => (
                    <li
                      key={w}
                      className="inline-flex items-center gap-1 rounded-md border border-dc-border bg-dc-elevated-muted px-2 py-1 text-dc-text"
                    >
                      {w}
                      <button type="button" className="text-dc-accent hover:underline" onClick={() => setWarnings((x) => x.filter((z) => z !== w))} aria-label={`Remove warning ${w}`}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="edc-difficulty" className="block text-xs font-medium text-dc-text-muted mb-1">
                  Difficulty
                </label>
                <select
                  id="edc-difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text focus:border-dc-accent focus:outline-none"
                >
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <option key={d || 'unset'} value={d}>
                      {d === '' ? '-' : d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edc-visibility" className="block text-xs font-medium text-dc-text-muted mb-1">
                  Visibility
                </label>
                <select
                  id="edc-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as EducationArticleVisibility)}
                  className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text focus:border-dc-accent focus:outline-none"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="MEMBERS">Signed-in members</option>
                  <option value="CONNECTIONS">Connections only</option>
                </select>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-dc-border bg-dc-surface-muted px-4 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-dc-border"
                checked={listInEducation}
                onChange={(e) => setListInEducation(e.target.checked)}
              />
              <div>
                <span className="text-sm font-medium text-dc-text">List on Education hub</span>
                <p className="text-[11px] text-dc-muted mt-0.5">
                  When publishing, curated hub listing requires categories and warnings. Editors may still remove listing
                  for moderation.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-teal-500/20 bg-teal-950/20 px-4 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-dc-border"
                checked={eckePublish}
                onChange={(e) => setEckePublish(e.target.checked)}
              />
              <div>
                <span className="text-sm font-medium text-dc-text">Publish to East Coast Kink Events</span>
                <p className="text-[11px] text-dc-muted mt-0.5">
                  When you publish, sync this article to eastcoastkinkevents.com education listings (requires public
                  visibility and published status).
                </p>
              </div>
            </label>

            {articleId && eckePublish ?
              <EducationArticleEckePanel articleId={articleId} />
            : null}

            <div>
              <span className="block text-xs font-medium text-dc-text-muted mb-2">Article body</span>
              <EducatorArticleEditor
                key={`${articleId ?? 'new'}-${hydrationKey}`}
                ref={editorRef}
                initialDoc={initialDocSeed ?? undefined}
                initialHtml={initialHtmlSeed ?? undefined}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" variant="primary" disabled={saving} onClick={() => void save('PUBLISHED')}>
              {saving ? 'Saving…' : 'Publish'}
            </Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => void save('DRAFT')}>
              Save draft
            </Button>
            {slug ?
              <Link
                target="_blank"
                rel="noreferrer noopener"
                to={`/education/${encodeURIComponent(slug)}`}
                className="inline-flex items-center rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-text-muted hover:text-dc-text"
              >
                Preview slug URL
              </Link>
            : null}
          </div>
        </>
      : null}
    </div>
  )
}
