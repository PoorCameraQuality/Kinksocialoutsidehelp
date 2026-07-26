'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildOrganizerCommands, type CommandContext } from './commandRegistry'

type FuzzyOption = { id: string; label: string; kind: 'person' | 'location' | 'track' }

export function OrganizerCommandPalette({
  open,
  onClose,
  context,
  fuzzyOptions = [],
}: {
  open: boolean
  onClose: () => void
  context: CommandContext
  fuzzyOptions?: FuzzyOption[]
}) {
  const [q, setQ] = useState('')
  const commands = useMemo(() => buildOrganizerCommands(context), [context])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return commands
    if (needle.startsWith('@')) {
      const sub = needle.slice(1)
      return fuzzyOptions
        .filter((o) => o.label.toLowerCase().includes(sub))
        .slice(0, 12)
        .map((o) => ({
          id: `jump-${o.id}`,
          group: `@ ${o.kind}`,
          label: `Jump to ${o.label}`,
          run: () => {
            if (o.kind === 'person') context.switchTab('people')
            else if (o.kind === 'location') context.switchTab('venues')
            else context.switchTab('settings')
          },
        }))
    }
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        c.group.toLowerCase().includes(needle) ||
        (c.keywords ?? '').toLowerCase().includes(needle),
    )
  }, [q, commands, fuzzyOptions, context])

  const run = useCallback(
    (id: string) => {
      const cmd = filtered.find((c) => c.id === id) ?? commands.find((c) => c.id === id)
      cmd?.run(context)
      onClose()
      setQ('')
    },
    [filtered, commands, context, onClose],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-dc-modal flex items-start justify-center bg-dc-text/35 px-4 pt-[12vh] backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-dc-border bg-dc-elevated shadow-2xl">
        <input
          autoFocus
          className="w-full border-b border-dc-border bg-transparent px-4 py-3 text-sm text-dc-text outline-none"
          placeholder="Type a command or @person / @room…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) {
              e.preventDefault()
              run(filtered[0].id)
            }
          }}
        />
        <ul className="max-h-72 overflow-y-auto py-2 text-sm">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-dc-surface-muted"
                onClick={() => run(c.id)}
              >
                <span>
                  <span className="text-dc-micro text-dc-muted">{c.group}</span>
                  <span className="block text-dc-text">{c.label}</span>
                </span>
                {'shortcut' in c && c.shortcut ? (
                  <span className="font-mono text-dc-micro text-dc-muted">{c.shortcut}</span>
                ) : null}
              </button>
            </li>
          ))}
          {!filtered.length ? <li className="px-4 py-3 text-dc-muted">No matches</li> : null}
        </ul>
      </div>
      <button type="button" className="absolute inset-0 -z-10" aria-label="Close palette" onClick={onClose} />
    </div>
  )
}

export function useOrganizerCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen])
}
