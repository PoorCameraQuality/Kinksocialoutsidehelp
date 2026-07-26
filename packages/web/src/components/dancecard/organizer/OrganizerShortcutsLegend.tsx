'use client'

import { useEffect, useState } from 'react'

const SHORTCUTS = [
  { keys: '⌘K / Ctrl+K', action: 'Command palette' },
  { keys: '?', action: 'Keyboard shortcuts (program grid)' },
  { keys: 'Esc', action: 'Close dialogs / palette' },
  { keys: 'G then P', action: 'Go to Program (via palette)' },
]

export function OrganizerShortcutsLegend() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onShow = () => setOpen(true)
    window.addEventListener('dc-organizer-show-shortcuts', onShow)
    return () => window.removeEventListener('dc-organizer-show-shortcuts', onShow)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-dc-modal flex items-center justify-center bg-dc-text/35 p-4 backdrop-blur-sm print:bg-white print:p-8">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-dc-border bg-dc-elevated p-6 print:border-black print:shadow-none">
        <h2 className="font-serif text-xl text-dc-text">Organizer shortcuts</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex justify-between gap-4 border-b border-dc-border py-2">
              <span className="font-mono text-dc-accent">{s.keys}</span>
              <span className="text-dc-muted">{s.action}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2 print:hidden">
          <button
            type="button"
            className="rounded-full border border-dc-border px-4 py-2 text-sm"
            onClick={() => window.print()}
          >
            Print
          </button>
          <button
            type="button"
            className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
      <button type="button" className="absolute inset-0 -z-10 print:hidden" aria-label="Close" onClick={() => setOpen(false)} />
    </div>
  )
}
