import { useId, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { filterRelationshipLabelSuggestions } from '@c2k/shared'

type Props = {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  suggestions: readonly string[]
  placeholder?: string
  id?: string
}

export default function LabelCombobox({
  label,
  hint,
  value,
  onChange,
  suggestions,
  placeholder = 'Search or type a custom label…',
  id: idProp,
}: Props) {
  const autoId = useId()
  const inputId = idProp ?? autoId
  const listId = `${inputId}-list`
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const filtered = useMemo(
    () => filterRelationshipLabelSuggestions(draft, suggestions),
    [draft, suggestions]
  )

  function commit(next: string) {
    const trimmed = next.trim()
    if (!trimmed) return
    onChange(trimmed)
    setDraft(trimmed)
    setOpen(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[0] && draft.trim().toLowerCase() === filtered[0].toLowerCase()) commit(filtered[0])
      else if (draft.trim()) commit(draft)
      else if (filtered[0]) commit(filtered[0])
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-dc-text mb-1">
        {label}
      </label>
      {hint ? <p className="text-xs text-dc-muted mb-2">{hint}</p> : null}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false)
              if (draft.trim() && draft.trim() !== value) commit(draft)
            }, 120)
          }}
          onKeyDown={onKeyDown}
          className="w-full min-h-11 px-4 py-3 rounded-lg border border-dc-border bg-dc-surface-muted text-dc-text placeholder:text-dc-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent"
        />
        {open && filtered.length > 0 ?
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-dc-border bg-dc-elevated-solid shadow-lg py-1"
          >
            {filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  className="w-full text-left px-3 py-2.5 text-sm text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(opt)}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        : null}
      </div>
    </div>
  )
}
