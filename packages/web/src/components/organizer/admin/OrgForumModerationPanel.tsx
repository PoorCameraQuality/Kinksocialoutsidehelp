import { useCallback, useEffect, useMemo, useState } from 'react'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import { useConfirm } from '@/hooks/useConfirm'

export type ForumCategory = {
  id: string
  name: string
  sortOrder?: number
}

export type OrgForumModerationPanelProps = {
  orgSlug: string
  /** When provided, panel uses controlled categories instead of fetching. */
  categories?: ForumCategory[] | null
  onCategoriesChange?: (categories: ForumCategory[]) => void
  /** Called after a category is deleted (e.g. to reset parent filters). */
  onCategoryDeleted?: (categoryId: string) => void
}

export default function OrgForumModerationPanel({
  orgSlug,
  categories: controlledCategories,
  onCategoriesChange,
  onCategoryDeleted,
}: OrgForumModerationPanelProps) {
  const { confirm, confirmDialog } = useConfirm()
  const orgKey = encodeURIComponent(orgSlug)
  const [internalCategories, setInternalCategories] = useState<ForumCategory[] | null>(
    controlledCategories === undefined ? null : controlledCategories
  )
  const [newForumCatName, setNewForumCatName] = useState('')
  const [editForumCatId, setEditForumCatId] = useState<string | null>(null)
  const [editForumCatName, setEditForumCatName] = useState('')
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const categories = controlledCategories !== undefined ? controlledCategories : internalCategories

  const setCategories = useCallback(
    (next: ForumCategory[]) => {
      if (controlledCategories === undefined) setInternalCategories(next)
      onCategoriesChange?.(next)
    },
    [controlledCategories, onCategoriesChange]
  )

  const reloadCategories = useCallback(async () => {
    const rc = await fetch(`/api/v1/organizations/${orgKey}/forum/categories`, { credentials: 'include' })
    if (rc.ok) {
      const d = (await rc.json()) as { items: ForumCategory[] }
      setCategories(d.items ?? [])
    }
  }, [orgKey, setCategories])

  useEffect(() => {
    if (controlledCategories !== undefined) return
    let cancelled = false
    ;(async () => {
      try {
        const rc = await fetch(`/api/v1/organizations/${orgKey}/forum/categories`, { credentials: 'include' })
        if (cancelled) return
        if (rc.ok) {
          const d = (await rc.json()) as { items: ForumCategory[] }
          setInternalCategories(d.items ?? [])
        } else {
          setInternalCategories([])
        }
      } catch {
        if (!cancelled) setInternalCategories([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgKey, controlledCategories])

  const sortedForumCategories = useMemo(() => {
    if (!categories) return []
    return [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
  }, [categories])

  async function addForumCategory(e: React.FormEvent) {
    e.preventDefault()
    setActionMsg(null)
    if (!newForumCatName.trim()) return
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/forum/categories`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newForumCatName.trim() }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setActionMsg(j.error ?? 'Could not add category')
        return
      }
      setNewForumCatName('')
      await reloadCategories()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function saveForumCategoryEdit() {
    if (!editForumCatId || !editForumCatName.trim()) return
    setActionMsg(null)
    try {
      const r = await fetch(
        `/api/v1/organizations/${orgKey}/forum/categories/${encodeURIComponent(editForumCatId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editForumCatName.trim() }),
        }
      )
      if (!r.ok) {
        setActionMsg('Could not update category')
        return
      }
      setEditForumCatId(null)
      await reloadCategories()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function deleteForumCategory(catId: string) {
    if (!(await confirm('Delete this category?', 'Threads will become uncategorized.', { destructive: true }))) return
    setActionMsg(null)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/forum/categories/${encodeURIComponent(catId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        setActionMsg('Could not delete')
        return
      }
      onCategoryDeleted?.(catId)
      await reloadCategories()
    } catch {
      setActionMsg('Network error')
    }
  }

  return (
    <OrganizerPanel
      title="Forum categories"
      description="Create and manage forum categories for thread organization."
    >
      <OrganizerFormSection title="Add category">
        <form onSubmit={addForumCategory} className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Forum category name"
            value={newForumCatName}
            onChange={(e) => setNewForumCatName(e.target.value)}
            placeholder="New category"
            className="min-w-0 flex-1 rounded-lg border border-dc-border bg-dc-elevated-solid px-2.5 py-2 text-sm text-dc-text sm:w-48"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-dc-border px-3 py-2 text-xs font-medium text-dc-text-muted hover:text-dc-text"
          >
            Add
          </button>
        </form>
      </OrganizerFormSection>

      {actionMsg && <p className="text-sm text-dc-muted">{actionMsg}</p>}

      <OrganizerFormSection title="Manage categories" description="Edit or remove existing forum categories.">
        {categories === null ? (
          <div className="h-16 animate-pulse rounded-xl bg-dc-elevated-muted" />
        ) : sortedForumCategories.length === 0 ? (
          <p className="text-sm text-dc-muted">No categories yet.</p>
        ) : (
          <ul className="space-y-2">
            {sortedForumCategories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                {editForumCatId === c.id ? (
                  <>
                    <input
                      aria-label="Edit forum category name"
                      value={editForumCatName}
                      onChange={(e) => setEditForumCatName(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-dc-text"
                    />
                    <button
                      type="button"
                      onClick={() => void saveForumCategoryEdit()}
                      className="text-xs text-dc-accent"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForumCatId(null)}
                      className="text-xs text-dc-muted"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 text-dc-text-muted">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditForumCatId(c.id)
                        setEditForumCatName(c.name)
                      }}
                      className="text-xs text-dc-accent"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteForumCategory(c.id)}
                      className="text-xs text-red-400/90"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </OrganizerFormSection>
      {confirmDialog}
    </OrganizerPanel>
  )
}
