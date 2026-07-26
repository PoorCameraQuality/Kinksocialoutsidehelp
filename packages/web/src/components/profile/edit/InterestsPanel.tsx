import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import ProfileStudioSectionCard from '@/components/profile/studio/ProfileStudioSectionCard'
import { profileStudioNestedRowClass } from '@/components/profile/studio/profile-studio-classes'
import { IconStar } from '@/components/profile/story/ProfileStoryIcons'
import { useProfileEdit } from '@/contexts/ProfileEditContext'
import { KINK_TAG_BROWSE_GROUPS } from '@c2k/shared'

const INTEREST_OPTIONS = [
  { value: 'into', label: 'Into' },
  { value: 'curious', label: 'Curious' },
  { value: 'soft_limit', label: 'Soft limit' },
  { value: 'hard_limit', label: 'Hard limit' },
  { value: 'not_into', label: 'Not into' },
] as const

export default function InterestsPanel() {
  const ctx = useProfileEdit()
  const showBrowseHint = !ctx.tagQuery.trim() && !ctx.tagBrowseRange

  return (
    <ProfileStudioSectionCard
      title="Interests & Discovery"
      description="Interests help people find shared context and make your profile easier to discover."
      icon={<IconStar />}
    >
    <div className="space-y-4">
      {ctx.kinks.length === 0 ?
        <ProfileStudioInsetCard>
          <p className="text-sm text-dc-text-muted">
            No interests yet. Add at least three to help people find shared context.
          </p>
        </ProfileStudioInsetCard>
      : null}
      {ctx.kinksError ?
        <p className="text-sm text-red-400" role="alert">{ctx.kinksError}</p>
      : null}

      <ProfileStudioInsetCard className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dc-text mb-1">Browse by category</label>
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
                  ctx.setTagBrowseRange(active ? null : { sortOrderMin: group.sortOrderMin, sortOrderMax: group.sortOrderMax })
                  if (!active) ctx.setTagQuery('')
                }}
                className={`min-h-9 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active ?
                    'bg-dc-accent text-dc-accent-fg'
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
        <label className="block text-sm font-medium text-dc-text mb-1">Add a tag</label>
        <input
          type="search"
          value={ctx.tagQuery}
          onChange={(e) => {
            ctx.setTagQuery(e.target.value)
            if (e.target.value.trim()) ctx.setTagBrowseRange(null)
          }}
          placeholder="Search interests…"
          className="w-full px-3 py-2 bg-dc-surface-muted border border-dc-border rounded-lg text-dc-text text-sm"
        />
        {showBrowseHint ?
          <p className="mt-1.5 text-xs text-dc-muted">Pick a category above or search 200+ BDSM & kink tags.</p>
        : null}
        {ctx.tagHits.length > 0 ?
          <ul className="mt-2 max-h-52 overflow-auto rounded-lg border border-dc-border bg-dc-surface-muted divide-y divide-white/5">
            {ctx.tagHits.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-dc-text-muted hover:bg-dc-elevated-muted"
                  onClick={() => ctx.addKinkTag(tag)}
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

      <ul className="space-y-3">
        {ctx.kinks.length === 0 ?
          <li className="text-sm text-dc-muted italic">No interests added yet (optional).</li>
        : ctx.kinks.map((k) => (
            <li key={k.kinkTagId} className={`${profileStudioNestedRowClass} space-y-2 p-3`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-dc-text">{k.displayName}</p>
                <button type="button" onClick={() => ctx.removeKink(k.kinkTagId)} className="text-xs text-red-400 hover:underline">
                  Remove
                </button>
              </div>
              <select
                className="w-full px-2 py-1.5 bg-dc-surface-muted border border-dc-border rounded text-dc-text text-sm"
                value={k.interestStatus}
                onChange={(e) =>
                  ctx.updateKink(k.kinkTagId, { interestStatus: e.target.value as typeof k.interestStatus })
                }
                aria-label={`Status for ${k.displayName}`}
              >
                {INTEREST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Note (optional)"
                value={k.note}
                onChange={(e) => ctx.updateKink(k.kinkTagId, { note: e.target.value })}
                className="w-full px-2 py-1.5 bg-dc-surface-muted border border-dc-border rounded text-dc-text text-sm"
              />
            </li>
          ))
        }
      </ul>
      <p className="text-xs text-dc-muted leading-relaxed">
        Only Into and Curious appear on your public profile when visibility allows. Limits stay private. Click{' '}
        <strong className="text-dc-text-muted font-medium">Save changes</strong> in the footer to persist interests.
      </p>
    </div>
    </ProfileStudioSectionCard>
  )
}
