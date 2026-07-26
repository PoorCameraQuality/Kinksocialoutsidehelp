import { useCallback, useEffect, useState } from 'react'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import { useConfirm } from '@/hooks/useConfirm'

type ForumCategory = {
  id: string
  name: string
  sortOrder?: number
}

type Props = {
  groupId: string
}

const inputClass =
  'w-full min-h-10 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted'

function StatusBanner({ message, isError, onDismiss }: { message: string; isError: boolean; onDismiss?: () => void }) {
  return (
    <div
      className={`text-sm rounded-xl border px-3 py-2 ${
        isError ?
          'border-red-500/30 bg-red-950/25 text-red-200'
        : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
      }`}
      role={isError ? 'alert' : 'status'}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="flex-1">{message}</p>
        {onDismiss ?
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            Dismiss
          </button>
        : null}
      </div>
    </div>
  )
}

export default function GroupForumModerationPanel({ groupId }: Props) {
  const { confirm, confirmDialog } = useConfirm()
  const groupKey = groupId
  const [categories, setCategories] = useState<ForumCategory[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempted, setLoadAttempted] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)

  const loadCategories = useCallback(async () => {
    setLoadError(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupKey)}/forum/categories`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setLoadError('Could not load forum categories.')
        return
      }
      const j = (await r.json()) as { items?: ForumCategory[] }
      setCategories(j.items ?? [])
    } catch {
      setLoadError('Network error loading forum categories.')
    } finally {
      setLoadAttempted(true)
    }
  }, [groupKey])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  useEffect(() => {
    if (!actionMsg || /fail|error|could not|network|not available/i.test(actionMsg)) return
    const timer = window.setTimeout(() => setActionMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [actionMsg])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    setActionMsg(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupKey)}/forum/categories`, {
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
      setActionMsg('Category added.')
      await loadCategories()
    } catch {
      setActionMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function saveCategoryEdit() {
    if (!editId || !editName.trim()) return
    setBusy(true)
    setActionMsg(null)
    try {
      const r = await fetch(
        `/api/v1/groups/${encodeURIComponent(groupKey)}/forum/categories/${encodeURIComponent(editId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName.trim() }),
        }
      )
      if (r.status === 404 || r.status === 405) {
        setActionMsg('PATCH /forum/categories/:id is not available yet on the group API.')
        return
      }
      if (!r.ok) {
        setActionMsg('Could not update category')
        return
      }
      setEditId(null)
      setEditName('')
      setActionMsg('Category updated.')
      await loadCategories()
    } catch {
      setActionMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteCategory(catId: string) {
    if (!(await confirm('Delete this category?', 'Threads will become uncategorized.', { destructive: true }))) return
    setBusy(true)
    setActionMsg(null)
    try {
      const r = await fetch(
        `/api/v1/groups/${encodeURIComponent(groupKey)}/forum/categories/${encodeURIComponent(catId)}`,
        { method: 'DELETE', credentials: 'include' }
      )
      if (r.status === 404 || r.status === 405) {
        setActionMsg('DELETE /forum/categories/:id is not available yet on the group API.')
        return
      }
      if (!r.ok) {
        setActionMsg('Could not delete category')
        return
      }
      if (editId === catId) {
        setEditId(null)
        setEditName('')
      }
      setActionMsg('Category deleted.')
      await loadCategories()
    } catch {
      setActionMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  const actionIsError = Boolean(actionMsg && /fail|error|could not|network|not available/i.test(actionMsg))

  return (
    <div className="space-y-4 max-w-3xl">
      <OrganizerPanel
        title="Forum categories"
        description="Create and organize discussion categories for the group forum."
      >
        {loadError ?
          <StatusBanner
            message={loadError}
            isError
            onDismiss={() => {
              setLoadError(null)
              void loadCategories()
            }}
          />
        : null}

        {actionMsg ?
          <StatusBanner message={actionMsg} isError={actionIsError} onDismiss={() => setActionMsg(null)} />
        : null}

        {!loadAttempted ?
          <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
        : null}

        {loadAttempted && !loadError ?
          <>
            <OrganizerFormSection title="Add category" description="New categories appear in the group forum filter.">
              <form onSubmit={addCategory} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Category name"
                  className={inputClass}
                  maxLength={255}
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !newName.trim()}
                  className="min-h-10 shrink-0 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
                >
                  Add
                </button>
              </form>
            </OrganizerFormSection>

            <OrganizerFormSection title="Existing categories">
              {categories.length === 0 ?
                <p className="text-sm text-dc-muted">No categories yet.</p>
              : (
                <ul className="divide-y divide-white/10 rounded-xl border border-dc-border">
                  {categories.map((cat) => (
                    <li key={cat.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                      {editId === cat.id ?
                        <>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={`${inputClass} flex-1 min-w-[12rem]`}
                            maxLength={255}
                            disabled={busy}
                          />
                          <button
                            type="button"
                            onClick={() => void saveCategoryEdit()}
                            disabled={busy || !editName.trim()}
                            className="min-h-10 rounded-xl bg-dc-accent px-3 text-sm text-dc-text disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(null)
                              setEditName('')
                            }}
                            disabled={busy}
                            className="min-h-10 rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
                          >
                            Cancel
                          </button>
                        </>
                      : <>
                          <span className="flex-1 text-sm text-dc-text">{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(cat.id)
                              setEditName(cat.name)
                            }}
                            disabled={busy}
                            className="min-h-10 rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteCategory(cat.id)}
                            disabled={busy}
                            className="min-h-10 rounded-xl border border-red-500/30 px-3 text-sm text-red-200 hover:bg-red-950/30"
                          >
                            Delete
                          </button>
                        </>
                      }
                    </li>
                  ))}
                </ul>
              )}
            </OrganizerFormSection>
          </>
        : null}
      {confirmDialog}
      </OrganizerPanel>
    </div>
  )
}
