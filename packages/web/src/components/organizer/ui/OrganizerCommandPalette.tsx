import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export type CommandAction = {
  id: string
  label: string
  href?: string
  onSelect?: () => void
  keywords?: string
}

type Props = {
  open: boolean
  onClose: () => void
  actions: CommandAction[]
}

export default function OrganizerCommandPalette({ open, onClose, actions }: Props) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        (a.keywords ?? '').toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q),
    )
  }, [actions, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlight(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => Math.min(h + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => Math.max(h - 1, 0))
      } else if (e.key === 'Enter' && filtered[highlight]) {
        e.preventDefault()
        const a = filtered[highlight]
        if (a.onSelect) a.onSelect()
        else if (a.href) navigate(a.href)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, highlight, navigate, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[15vh]" role="dialog" aria-modal aria-label="Command palette">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-dc-border bg-dc-elevated-solid shadow-2xl">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlight(0)
          }}
          placeholder="Jump to tab, open hub, create…"
          className="w-full border-b border-dc-border bg-transparent px-4 py-3 text-sm text-dc-text placeholder:text-dc-muted focus:outline-none"
        />
        <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
          {filtered.length === 0 ?
            <li className="px-4 py-3 text-sm text-dc-muted">No matches</li>
          : filtered.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={`flex w-full px-4 py-2.5 text-left text-sm ${
                    i === highlight ? 'bg-dc-accent/15 text-dc-text' : 'text-dc-text-muted hover:bg-dc-elevated-muted'
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    if (a.onSelect) a.onSelect()
                    else if (a.href) navigate(a.href)
                    onClose()
                  }}
                >
                  {a.label}
                </button>
              </li>
            ))}
        </ul>
      </div>
      <button type="button" className="absolute inset-0 -z-10 cursor-default" aria-label="Close" onClick={onClose} />
    </div>
  )
}
