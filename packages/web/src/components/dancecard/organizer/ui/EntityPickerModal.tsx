'use client'

import { useMemo, useState } from 'react'

const glassClass =
  'rounded-2xl border border-dc-border bg-dc-elevated-solid/98 shadow-[0_16px_48px_rgba(45,38,28,0.14)] backdrop-blur-sm'

export type EntityPickerOption = { id: string; label: string; sublabel?: string }

export function EntityPickerModal({
  open,
  title,
  options,
  emptyLabel = 'No items found.',
  onSelect,
  onCancel,
}: {
  open: boolean
  title: string
  options: EntityPickerOption[]
  emptyLabel?: string
  onSelect: (id: string) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        o.id.toLowerCase().includes(needle) ||
        (o.sublabel?.toLowerCase().includes(needle) ?? false),
    )
  }, [options, q])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-dc-elevated-solid/70 p-4 backdrop-blur-md sm:items-center">
      <div className={`flex max-h-[min(85dvh,560px)] w-full max-w-lg flex-col ${glassClass}`}>
        <div className="border-b border-dc-border px-5 py-4">
          <h2 className="font-serif text-xl text-dc-text">{title}</h2>
          <input
            type="search"
            autoFocus
            className="mt-3 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.length ? (
            filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-white/5"
                  onClick={() => {
                    onSelect(o.id)
                    setQ('')
                  }}
                >
                  <span className="block text-sm font-medium text-dc-text">{o.label}</span>
                  {o.sublabel ? <span className="block text-xs text-dc-muted">{o.sublabel}</span> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-6 text-center text-sm text-dc-muted">{emptyLabel}</li>
          )}
        </ul>
        <div className="border-t border-dc-border px-5 py-3">
          <button
            type="button"
            className="w-full rounded-full border border-dc-border py-2 text-sm text-dc-text hover:bg-white/5"
            onClick={() => {
              setQ('')
              onCancel()
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
