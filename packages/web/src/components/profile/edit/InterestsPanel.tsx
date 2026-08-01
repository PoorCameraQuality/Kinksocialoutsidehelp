import { useState } from 'react'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import { useProfileEdit } from '@/contexts/ProfileEditContext'
import { KINK_TAG_BROWSE_GROUPS } from '@c2k/shared'

const INTEREST_OPTIONS = [
  { value: 'into', label: 'Into' },
  { value: 'curious', label: 'Curious' },
  { value: 'soft_limit', label: 'Soft limit' },
  { value: 'hard_limit', label: 'Hard limit' },
  { value: 'not_into', label: 'Not into' },
] as const

function statusLabel(value: string): string {
  return INTEREST_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export default function InterestsPanel() {
  const ctx = useProfileEdit()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [browseOpen, setBrowseOpen] = useState(ctx.kinks.length === 0)
  const showBrowseHint = !ctx.tagQuery.trim() && !ctx.tagBrowseRange

  return (
    <div className="space-y-5">
      {ctx.kinksError ?
        <p className="text-sm text-red-400" role="alert">{ctx.kinksError}</p>
      : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-dc-text">Your interests</h3>
          <p className="mt-0.5 text-xs text-dc-muted">
            {ctx.kinks.length === 0 ?
              'Add interests so people can find shared context.'
            : `${ctx.kinks.length} selected · Into and Curious can appear publicly when visibility allows.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBrowseOpen((open) => !open)}
          className="min-h-10 rounded-lg border border-dc-border-subtle px-3 text-sm font-medium text-dc-text hover:border-dc-accent"
        >
          {browseOpen ? 'Hide browser' : 'Add interests'}
        </button>
      </div>

      {browseOpen ?
        <ProfileStudioInsetCard className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-dc-text">Browse by category</label>
            <div className="flex flex-wrap gap-2">
              {KINK_TAG_BROWSE_GROUPS.map((group) => {
                const active =
                  ctx.tagBrowseRange?.sortOrderMin === group.sortOrderMin &&
                  ctx.tagBrowseRange?.sortOrderMax === group.sortOrderMax
                return (
                  <button
                    key={group.label}
                    type="button"
                    onClick={() => {
                      ctx.setTagBrowseRange(
                        active ? null : { sortOrderMin: group.sortOrderMin, sortOrderMax: group.sortOrderMax },
                      )
                      if (!active) ctx.setTagQuery('')
                    }}
                    className={`min-h-10 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active ?
                        'bg-dc-accent text-dc-accent-foreground'
                      : 'border border-dc-border bg-dc-surface-muted text-dc-text-muted hover:border-dc-accent/40 hover:text-dc-text'
                    }`}
                  >
                    {group.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-dc-text">Search</label>
            <input
              type="search"
              value={ctx.tagQuery}
              onChange={(e) => {
                ctx.setTagQuery(e.target.value)
                if (e.target.value.trim()) ctx.setTagBrowseRange(null)
              }}
              placeholder="Search interests…"
              className="w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
            />
            {showBrowseHint ?
              <p className="mt-1.5 text-xs text-dc-muted">Pick a category or search 200+ tags.</p>
            : null}
            {ctx.tagHits.length > 0 ?
              <ul className="mt-2 max-h-52 divide-y divide-white/5 overflow-auto rounded-lg border border-dc-border bg-dc-surface-muted">
                {ctx.tagHits.map((tag) => (
                  <li key={tag.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 text-left text-sm text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
                      onClick={() => {
                        ctx.addKinkTag(tag)
                        setEditingId(tag.id)
                      }}
                    >
                      {tag.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            : ctx.tagQuery.trim() || ctx.tagBrowseRange ?
              <p className="mt-2 text-xs text-dc-muted">No matching tags — try another category or search term.</p>
            : null}
          </div>
        </ProfileStudioInsetCard>
      : null}

      <ul className="divide-y divide-dc-border-subtle rounded-xl border border-dc-border-subtle bg-dc-elevated-solid/60">
        {ctx.kinks.length === 0 ?
          <li className="px-4 py-6 text-sm text-dc-muted">No interests yet.</li>
        : ctx.kinks.map((k) => {
            const expanded = editingId === k.kinkTagId
            return (
              <li key={k.kinkTagId} className="px-3 py-2.5 sm:px-4">
                {!expanded ?
                  <div className="flex min-h-11 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-dc-text">{k.displayName}</p>
                      {k.note.trim() ?
                        <p className="truncate text-xs text-dc-muted">{k.note}</p>
                      : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-dc-text-muted">{statusLabel(k.interestStatus)}</span>
                      <button
                        type="button"
                        onClick={() => setEditingId(k.kinkTagId)}
                        className="text-sm font-medium text-dc-accent hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                : (
                  <div className="space-y-3 py-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-dc-text">{k.displayName}</p>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-dc-muted hover:text-dc-text"
                      >
                        Done
                      </button>
                    </div>
                    <label className="block text-xs font-medium text-dc-text-muted">
                      Interest level
                      <select
                        className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                        value={k.interestStatus}
                        onChange={(e) =>
                          ctx.updateKink(k.kinkTagId, {
                            interestStatus: e.target.value as typeof k.interestStatus,
                          })
                        }
                      >
                        {INTEREST_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-dc-text-muted">
                      Optional context
                      <input
                        type="text"
                        placeholder="What would you like others to know?"
                        value={k.note}
                        onChange={(e) => ctx.updateKink(k.kinkTagId, { note: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                      />
                    </label>
                    <p className="text-xs text-dc-muted">Uses your Interests visibility setting.</p>
                    <button
                      type="button"
                      onClick={() => {
                        ctx.removeKink(k.kinkTagId)
                        setEditingId(null)
                      }}
                      className="text-sm font-medium text-dc-danger hover:underline"
                    >
                      Remove interest
                    </button>
                  </div>
                )}
              </li>
            )
          })}
      </ul>
    </div>
  )
}
