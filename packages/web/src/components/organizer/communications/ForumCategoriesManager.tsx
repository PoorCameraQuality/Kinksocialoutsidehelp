import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ForumCategory } from '@/components/organizer/admin/OrgForumModerationPanel'
import { CommsSection } from '@/components/organizer/communications/comms-ui'
import EmptyState from '@/components/ui/EmptyState'
import { useConfirm } from '@/hooks/useConfirm'
import { cn } from '@/lib/cn'
import { FORUM_CATEGORY_SUGGESTIONS } from '@/lib/organizer/org-comms-utils'

type Props = {
  orgSlug?: string
  groupId?: string
  categories: ForumCategory[] | null
  canManage: boolean
  publicForumsHref: string
  onReload: () => Promise<void>
  sectionId?: string
}

function forumCategoriesApiBase(orgSlug?: string, groupId?: string): string {
  if (groupId) return `/api/v1/groups/${encodeURIComponent(groupId)}/forum/categories`
  if (orgSlug) return `/api/v1/organizations/${encodeURIComponent(orgSlug)}/forum/categories`
  throw new Error('ForumCategoriesManager requires orgSlug or groupId')
}

export default function ForumCategoriesManager({
  orgSlug,
  groupId,
  categories,
  canManage,
  publicForumsHref,
  onReload,
  sectionId = 'forum-categories',
}: Props) {
  const { confirm, confirmDialog } = useConfirm()
  const categoriesBase = forumCategoriesApiBase(orgSlug, groupId)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const sorted = useMemo(() => {
    if (!categories) return []
    return [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
  }, [categories])

  const addCategory = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setActionMsg(null)
      if (!newName.trim()) return
      try {
        const r = await fetch(categoriesBase, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim() }),
        })
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        if (!r.ok) {
          setActionMsg(j.error ?? 'Could not add category')
          return
        }
        setNewName('')
        await onReload()
      } catch {
        setActionMsg('Network error')
      }
    },
    [categoriesBase, newName, onReload],
  )

  async function saveEdit() {
    if (!editId || !editName.trim()) return
    setActionMsg(null)
    try {
      const r = await fetch(`${categoriesBase}/${encodeURIComponent(editId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (!r.ok) {
        setActionMsg('Could not update category')
        return
      }
      setEditId(null)
      await onReload()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function removeCategory(catId: string) {
    if (!(await confirm('Delete this category?', 'Threads will become uncategorized.', { destructive: true }))) return
    setActionMsg(null)
    try {
      const r = await fetch(`${categoriesBase}/${encodeURIComponent(catId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        setActionMsg('Could not delete category')
        return
      }
      await onReload()
    } catch {
      setActionMsg('Network error')
    }
  }

  const categoryOpenHref = (id: string) =>
    `${publicForumsHref}${publicForumsHref.includes('?') ? '&' : '?'}categoryId=${encodeURIComponent(id)}`

  return (
    <CommsSection id={sectionId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dc-text">Forum categories</h3>
          <p className="mt-1 text-sm text-dc-text-muted">Create categories to organize longer member discussions.</p>
        </div>
        {canManage && sorted.length > 0 ?
          <a
            href={`#${sectionId}`}
            className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            + Add category
          </a>
        : null}
      </div>

      {canManage ?
        <form onSubmit={(e) => void addCategory(e)} className="mt-5 space-y-3 rounded-xl border border-dc-border bg-dc-surface/30 p-4">
          <label className="block text-sm font-medium text-dc-text" htmlFor="forum-cat-name">
            Category name
          </label>
          <input
            id="forum-cat-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Announcements"
            className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
          />
          <div className="flex flex-wrap gap-2">
            {FORUM_CATEGORY_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNewName(s)}
                className="rounded-lg border border-dc-border px-2.5 py-1 text-xs text-dc-text-muted hover:border-dc-accent-border/40 hover:text-dc-text"
              >
                {s}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50 sm:w-auto"
          >
            Add category
          </button>
        </form>
      : null}

      {actionMsg ?
        <p className="mt-3 text-sm text-amber-200/90" role="status">
          {actionMsg}
        </p>
      : null}

      <div className="mt-5">
        {categories === null ?
          <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
        : sorted.length === 0 ?
          <EmptyState
            inline
            title="No forum categories yet"
            message="Create your first category to give members a clear place to post introductions, announcements, planning, or resources."
            actionLabel={canManage ? 'Add category above' : undefined}
            onAction={canManage ? () => document.getElementById('forum-cat-name')?.focus() : undefined}
            secondaryCtaLabel="Open member forums"
            secondaryCtaHref={publicForumsHref}
          />
        : (
          <ul className="space-y-2">
            {sorted.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-dc-border bg-dc-surface/25 px-4 py-3 sm:flex sm:items-center sm:gap-4"
              >
                {editId === c.id && canManage ?
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
                      aria-label="Category name"
                    />
                    <button type="button" onClick={() => void saveEdit()} className="text-sm font-medium text-dc-accent">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditId(null)} className="text-sm text-dc-muted">
                      Cancel
                    </button>
                  </div>
                : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-dc-text">{c.name}</p>
                      <p className="mt-0.5 text-xs text-dc-muted">Public on member forums</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
                      {canManage ?
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(c.id)
                            setEditName(c.name)
                          }}
                          className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text"
                        >
                          Edit
                        </button>
                      : null}
                      <Link
                        to={categoryOpenHref(c.id)}
                        className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-accent hover:underline"
                      >
                        Open
                      </Link>
                      {canManage ?
                        <button
                          type="button"
                          onClick={() => void removeCategory(c.id)}
                          className={cn(
                            'inline-flex min-h-9 items-center rounded-lg border border-red-500/30 px-3 text-xs font-medium text-red-300/90',
                          )}
                        >
                          Remove
                        </button>
                      : null}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {sorted.length > 0 ?
        <Link to={publicForumsHref} className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
          View all forum categories on hub →
        </Link>
      : null}
      {confirmDialog}
    </CommsSection>
  )
}
