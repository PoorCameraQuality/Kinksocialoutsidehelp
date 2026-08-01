import { useEffect, useMemo, useState } from 'react'
import SelectableChip from './SelectableChip'
import type { ChipOption } from './ChipGroup'

const SUGGESTED_COUNT = 10

export default function TagBrowserSheet({
  open,
  title,
  hint,
  options,
  selected,
  tone = 'interest',
  onToggle,
  onClose,
}: {
  open: boolean
  title: string
  hint?: string
  options: readonly ChipOption[]
  selected: string[]
  tone?: 'interest' | 'hardNo'
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [viewAll, setViewAll] = useState(false)

  useEffect(() => {
    if (!open) {
      setQ('')
      setViewAll(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const selectedOpts = useMemo(
    () => options.filter((o) => selected.includes(o.id)),
    [options, selected],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const pool = needle
      ? options.filter((o) => o.label.toLowerCase().includes(needle) || o.id.includes(needle))
      : viewAll
        ? options
        : options.slice(0, SUGGESTED_COUNT)
    return pool
  }, [options, q, viewAll])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-dc-modal flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="min-h-0 flex-1 bg-black/70" aria-label="Close" onClick={onClose} />
      <div className="flex max-h-[88vh] flex-col rounded-t-2xl border border-dc-border bg-dc-elevated shadow-[var(--dc-shadow-panel)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between gap-3 border-b border-dc-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-dc-text">{title}</p>
            {hint ? <p className="text-[13px] text-dc-muted">{hint}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
          >
            Done
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          {selectedOpts.length > 0 ?
            <div>
              <p className="mb-2 text-[12px] font-medium text-dc-muted">{selectedOpts.length} selected</p>
              <div className="flex flex-wrap gap-2">
                {selectedOpts.map((o) => (
                  <SelectableChip
                    key={o.id}
                    label={o.label}
                    selected
                    tone={tone}
                    onClick={() => onToggle(o.id)}
                  />
                ))}
              </div>
            </div>
          : null}

          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tags…"
            className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-[15px] text-dc-text placeholder:text-dc-muted"
          />

          <div className="flex flex-wrap gap-2">
            {filtered.map((o) => (
              <SelectableChip
                key={o.id}
                label={o.label}
                selected={selected.includes(o.id)}
                tone={tone}
                onClick={() => onToggle(o.id)}
              />
            ))}
          </div>

          {!q && !viewAll && options.length > SUGGESTED_COUNT ?
            <button
              type="button"
              onClick={() => setViewAll(true)}
              className="min-h-11 text-sm font-medium text-dc-accent"
            >
              View all {options.length} tags
            </button>
          : null}

          {q && filtered.length === 0 ?
            <p className="text-sm text-dc-muted">No matching tags. Try a broader word.</p>
          : null}
        </div>
      </div>
    </div>
  )
}
