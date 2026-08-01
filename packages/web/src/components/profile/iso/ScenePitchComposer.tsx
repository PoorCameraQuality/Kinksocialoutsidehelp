import { useEffect, useState } from 'react'
import {
  ISO_MENU_TAGS,
  ISO_PITCH_INTENSITY,
  ISO_PITCH_ROLE,
  ISO_PITCH_SEX,
  emptyIsoPitch,
  type IsoScenePitch,
} from '@c2k/shared'
import ChipGroup from './ChipGroup'
import SelectableChip from './SelectableChip'

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(0, 12)
}

export default function ScenePitchComposer({
  open,
  initial,
  onCancel,
  onDone,
}: {
  open: boolean
  initial?: IsoScenePitch | null
  onCancel: () => void
  onDone: (pitch: IsoScenePitch) => void
}) {
  const [draft, setDraft] = useState<IsoScenePitch>(() => initial ?? emptyIsoPitch())

  useEffect(() => {
    if (open) setDraft(initial ?? emptyIsoPitch())
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const canDone = Boolean(draft.title.trim() || draft.description.trim())

  return (
    <div className="fixed inset-0 z-dc-modal flex flex-col bg-dc-surface" role="dialog" aria-modal="true" aria-label="Scene composer">
      <header className="flex items-center justify-between gap-2 border-b border-dc-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-sm font-medium text-dc-text-muted">
          Cancel
        </button>
        <p className="text-sm font-semibold text-dc-text">{initial ? 'Edit scene' : 'New scene'}</p>
        <button
          type="button"
          disabled={!canDone}
          onClick={() => onDone(draft)}
          className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-40"
        >
          Save
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-10">
        <div>
          <label className="block text-[13px] font-medium text-dc-text mb-1">Name this scene</label>
          <input
            value={draft.title}
            maxLength={120}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="Slow restraint, rough and playful, service with direction…"
            className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
          />
          <p className="mt-1 text-[12px] text-dc-muted">{120 - draft.title.length} characters left</p>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-dc-text mb-1">What would make it good?</label>
          <textarea
            value={draft.description}
            maxLength={2000}
            rows={4}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            placeholder="Describe the energy, activity, pace, or kind of connection you want."
            className="w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-[15px] text-dc-text"
          />
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-dc-text">What kind of plan is this?</p>
          <ChipGroup
            options={ISO_PITCH_INTENSITY}
            selected={draft.intensity}
            exclusive
            onToggle={(id) => setDraft((p) => ({ ...p, intensity: id as IsoScenePitch['intensity'] }))}
          />
          <p className="mt-2 text-[12px] text-dc-muted">
            {ISO_PITCH_INTENSITY.find((o) => o.id === draft.intensity)?.hint}
          </p>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-dc-text">How do you see yourself in it?</p>
          <ChipGroup
            options={ISO_PITCH_ROLE}
            selected={draft.myRole}
            exclusive
            onToggle={(id) => setDraft((p) => ({ ...p, myRole: id as IsoScenePitch['myRole'] }))}
          />
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-dc-text">Sexual context</p>
          <ChipGroup
            options={ISO_PITCH_SEX}
            selected={draft.sex}
            exclusive
            onToggle={(id) => setDraft((p) => ({ ...p, sex: id as IsoScenePitch['sex'] }))}
          />
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-dc-text">Add a few useful tags</p>
          <div className="flex flex-wrap gap-2">
            {ISO_MENU_TAGS.slice(0, 18).map((o) => (
              <SelectableChip
                key={o.id}
                label={o.label}
                tone="interest"
                selected={draft.tags.includes(o.id)}
                onClick={() => setDraft((p) => ({ ...p, tags: toggle(p.tags, o.id) }))}
              />
            ))}
          </div>
        </div>

        {(draft.title.trim() || draft.description.trim()) ?
          <div className="rounded-2xl border border-dc-border bg-dc-elevated p-4">
            <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Preview</p>
            <p className="mt-2 text-[18px] font-semibold text-dc-text">{draft.title.trim() || 'Untitled scene'}</p>
            {draft.description.trim() ?
              <p className="mt-1 text-[15px] leading-relaxed text-dc-text-muted line-clamp-3">{draft.description}</p>
            : null}
            <p className="mt-2 text-[13px] text-dc-muted">
              {[
                ISO_PITCH_INTENSITY.find((x) => x.id === draft.intensity)?.label,
                ISO_PITCH_ROLE.find((x) => x.id === draft.myRole)?.label,
                ISO_PITCH_SEX.find((x) => x.id === draft.sex)?.label,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        : null}
      </div>
    </div>
  )
}
