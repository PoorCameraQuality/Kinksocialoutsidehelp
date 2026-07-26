import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import Dialog from '@/components/ui/Dialog'

const TAG_OTHER = 'Other (describe below)'
const DROPDOWN_LIMIT = 24

export type TagSuggestionGroup = {
  label: string
  options: readonly string[]
}

type Props = {
  label: string
  hint?: string
  values: string[]
  onChange: (next: string[]) => void
  suggestions?: readonly string[]
  suggestionGroups?: readonly TagSuggestionGroup[]
  maxCount: number
  placeholder?: string
  allowCustom?: boolean
  id?: string
  /** When set with `activeBrowseId`, only one browse sheet is open across a form. */
  browseId?: string
  activeBrowseId?: string | null
  onActiveBrowseIdChange?: (id: string | null) => void
}

export default function TagMultiSelect({
  label,
  hint,
  values,
  onChange,
  suggestions = [],
  suggestionGroups = [],
  maxCount,
  placeholder = 'Type to search…',
  allowCustom = true,
  id: idProp,
  browseId,
  activeBrowseId,
  onActiveBrowseIdChange,
}: Props) {
  const autoId = useId()
  const inputId = idProp ?? autoId
  const browseButtonId = `${inputId}-browse`
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [localBrowseOpen, setLocalBrowseOpen] = useState(false)

  const browseControlled = browseId != null && onActiveBrowseIdChange != null
  const browseOpen = browseControlled ? activeBrowseId === browseId : localBrowseOpen

  function setBrowseOpen(next: boolean) {
    if (browseControlled) {
      onActiveBrowseIdChange!(next ? browseId! : null)
    } else {
      setLocalBrowseOpen(next)
    }
  }

  function openBrowse() {
    if (browseControlled) {
      onActiveBrowseIdChange!(browseId!)
    } else {
      setLocalBrowseOpen(true)
    }
  }

  const atMax = values.length >= maxCount

  const optionPool = useMemo(() => {
    const raw = suggestionGroups.length > 0 ?
      suggestionGroups.flatMap((g) => g.options)
    : suggestions
    return raw.filter((o) => o !== TAG_OTHER)
  }, [suggestionGroups, suggestions])

  const available = useMemo(
    () => optionPool.filter((s) => !values.includes(s)),
    [optionPool, values],
  )

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase()
    const base = q ?
      available.filter((s) => s.toLowerCase().includes(q))
    : available
    return base.slice(0, DROPDOWN_LIMIT)
  }, [draft, available])

  const browseGroups = useMemo(() => {
    if (suggestionGroups.length > 0) {
      return suggestionGroups
        .map((g) => ({
          label: g.label,
          options: g.options.filter((o) => o !== TAG_OTHER && !values.includes(o)),
        }))
        .filter((g) => g.options.length > 0)
    }
    if (available.length === 0) return []
    return [{ label: 'Suggestions', options: available }]
  }, [suggestionGroups, available, values])

  function addValue(raw: string) {
    const v = raw.trim()
    if (!v || values.includes(v) || values.length >= maxCount) return
    onChange([...values, v])
    setDraft('')
    setOpen(false)
    if (values.length + 1 >= maxCount) setBrowseOpen(false)
  }

  function removeValue(v: string) {
    onChange(values.filter((x) => x !== v))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[0] && !allowCustom) addValue(filtered[0])
      else if (allowCustom && draft.trim()) addValue(draft)
      else if (filtered[0]) addValue(filtered[0])
    }
    if (e.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  const closeBrowseButton = (
    <button
      type="button"
      onClick={() => setBrowseOpen(false)}
      className="shrink-0 rounded-lg border border-dc-border px-2.5 py-1 text-xs text-dc-text-muted hover:text-dc-text"
      aria-label="Close"
    >
      Close
    </button>
  )

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-dc-text mb-1">
        {label}
        <span className="text-dc-muted font-normal"> (max {maxCount})</span>
      </label>
      {hint ? <p className="text-xs text-dc-muted mb-2">{hint}</p> : null}
      <div
        className={`min-h-11 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border bg-dc-surface-muted ${
          atMax ? 'border-dc-border opacity-90' : 'border-dc-border focus-within:border-dc-accent focus-within:ring-1 focus-within:ring-dc-accent'
        }`}
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 max-w-full rounded-md border border-dc-border bg-dc-elevated/95 px-2 py-1 text-sm text-dc-text"
          >
            <span className="truncate">{v}</span>
            <button
              type="button"
              onClick={() => removeValue(v)}
              className="shrink-0 text-dc-muted hover:text-dc-text"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
        {!atMax ?
          <input
            id={inputId}
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={values.length === 0 ? placeholder : 'Search…'}
            className="flex-1 min-w-[8rem] bg-transparent text-sm text-dc-text placeholder:text-dc-muted outline-none"
            aria-autocomplete="list"
            aria-expanded={open && filtered.length > 0}
          />
        : null}
      </div>

      {open && filtered.length > 0 && !atMax ?
        <ul
          className="mt-1 max-h-48 overflow-auto rounded-lg border border-dc-border bg-dc-surface-muted shadow-lg divide-y divide-white/5"
          role="listbox"
        >
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                className="w-full text-left px-3 py-2 text-sm text-dc-text-muted hover:bg-dc-elevated-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addValue(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      : null}

      {!atMax && browseGroups.length > 0 ?
        <button
          type="button"
          id={browseButtonId}
          onClick={openBrowse}
          className="mt-2 text-xs font-medium text-dc-accent hover:underline"
        >
          Browse {available.length} options
        </button>
      : null}

      {allowCustom ?
        <p className="mt-1 text-[11px] text-dc-muted">Type a custom value and press Enter.</p>
      : null}

      <Dialog
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        title={label}
        description={`Choose up to ${maxCount}. ${values.length} selected.`}
        variant="sheet"
        maxWidthClass="max-w-lg"
        layout="wizard"
        headerExtra={closeBrowseButton}
        footer={
          <button
            type="button"
            onClick={() => setBrowseOpen(false)}
            className="min-h-10 px-4 rounded-lg text-sm font-medium bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Done
          </button>
        }
      >
        <div className="space-y-4">
          {browseGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted mb-2">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => addValue(option)}
                    disabled={atMax}
                    className="rounded-md border border-dc-border bg-dc-elevated/80 px-2.5 py-1.5 text-xs text-dc-text-muted hover:border-dc-accent/60 hover:text-dc-text disabled:opacity-40"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  )
}
