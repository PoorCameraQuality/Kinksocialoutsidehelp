'use client'

import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  disabled?: boolean
  defaultOpen?: boolean
  onImportCsv: (text: string) => void
  onImportJson: (text: string) => void
}

export function ImportSignupsMenu({ disabled, defaultOpen = false, onImportCsv, onImportJson }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [mode, setMode] = useState<'csv' | 'json' | null>(null)
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setMode(null)
    setText('')
  }, [])

  function runImport() {
    if (!text.trim()) return
    if (mode === 'csv') onImportCsv(text)
    else if (mode === 'json') onImportJson(text)
    close()
  }

  function onFilePick(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? '')
      setText(content)
      setMode(file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv')
      setOpen(true)
    }
    reader.readAsText(file)
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        className="min-h-10 rounded-xl border border-dc-border px-4 py-2 text-sm font-medium text-dc-text hover:bg-dc-surface-muted disabled:opacity-40"
        onClick={() => setOpen((v) => !v)}
      >
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFilePick(f)
          e.target.value = ''
        }}
      />
      {open ? (
        <>
          <div className="fixed inset-0 z-dc-modal-backdrop" aria-hidden onClick={close} />
          <div className="absolute left-0 top-full z-dc-modal mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-dc-border bg-dc-elevated-solid p-4 shadow-lg">
            {!mode ? (
              <ul className="space-y-1 text-sm">
                <li>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left font-medium hover:bg-dc-surface-muted"
                    onClick={() => setMode('csv')}
                  >
                    Import CSV
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left font-medium hover:bg-dc-surface-muted"
                    onClick={() => fileRef.current?.click()}
                  >
                    Upload CSV or JSON file…
                  </button>
                </li>
                <li className="pt-2">
                  <details className="rounded-lg border border-dc-border/60 bg-dc-surface-muted/40 px-2 py-1">
                    <summary className="cursor-pointer px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-dc-muted">
                      Advanced
                    </summary>
                    <button
                      type="button"
                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-dc-muted hover:bg-dc-surface-muted"
                      onClick={() => setMode('json')}
                    >
                      Paste JSON import…
                    </button>
                  </details>
                </li>
              </ul>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-dc-text">
                  {mode === 'csv' ? 'Paste CSV' : 'Paste JSON'}
                </p>
                <p className="text-xs text-dc-muted">
                  {mode === 'csv'
                    ? 'Header row required: name, category, email (must match a Kink Social account).'
                    : 'Shape: { "rows": [{ "email", "categoryName" }] }'}
                </p>
                <textarea
                  className={cn(
                    'w-full min-h-[120px] rounded-lg border border-dc-border bg-dc-surface-muted p-2 font-mono text-xs text-dc-text',
                  )}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    mode === 'csv'
                      ? 'name,category,email\nAlex,Full Weekend,a@b.co'
                      : '{"rows":[{"sceneDisplayName":"Alex","categoryName":"Full Weekend","email":"a@b.co"}]}'
                  }
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={disabled || !text.trim()}
                    className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
                    onClick={runImport}
                  >
                    Run import
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-muted hover:bg-dc-surface-muted"
                    onClick={() => setMode(null)}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
