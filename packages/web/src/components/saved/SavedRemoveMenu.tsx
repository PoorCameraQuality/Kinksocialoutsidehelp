import { useEffect, useRef, useState } from 'react'

type Props = {
  onRemove: () => void
  busy?: boolean
  label?: string
}

export default function SavedRemoveMenu({ onRemove, busy, label = 'Remove from saved' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-dc-border/80 bg-dc-elevated-solid/90 text-sm text-dc-text-muted backdrop-blur-sm hover:text-dc-text disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Saved item options"
      >
        ···
      </button>
      {open ?
        <ul
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-lg"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                onRemove()
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-dc-elevated-muted disabled:opacity-50"
            >
              {busy ? 'Removing…' : label}
            </button>
          </li>
        </ul>
      : null}
    </div>
  )
}
