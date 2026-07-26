'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'

const DEFAULT_COLUMNS = ['category', 'status', 'vetting', 'email'] as const
type ColumnKey = (typeof DEFAULT_COLUMNS)[number] | 'external'

const COLUMN_LABELS: Record<ColumnKey, string> = {
  category: 'Category',
  status: 'Status',
  vetting: 'Vetting',
  email: 'Email',
  external: 'External',
}

function viewsKey(eventSlug: string) {
  return `dc-registrants-views:${eventSlug.toLowerCase()}`
}

export function RegistrantsMasterDetail<TRow extends { id: string; sceneDisplayName: string }>({
  eventSlug,
  rows,
  readOnly,
  selectedId,
  onSelect,
  onClearSelection,
  renderDetail,
  renderCheckIn,
  renderPersonRosterLink,
  getCell,
}: {
  eventSlug: string
  rows: TRow[]
  readOnly: boolean
  selectedId: string | null
  onSelect: (row: TRow) => void
  onClearSelection?: () => void
  renderDetail: () => React.ReactNode
  renderCheckIn?: (row: TRow) => React.ReactNode
  /** When this signup is linked to a roster person, show a shortcut to People → Roster. */
  renderPersonRosterLink?: (row: TRow) => React.ReactNode
  getCell: (row: TRow, col: ColumnKey) => React.ReactNode
}) {
  const [columns, setColumns] = useState<ColumnKey[]>([...DEFAULT_COLUMNS])
  const [showChooser, setShowChooser] = useState(false)
  const [savedViews, setSavedViews] = useState<{ name: string; columns: ColumnKey[] }[]>([])
  const [viewName, setViewName] = useState('')

  const selectedRow = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(viewsKey(eventSlug))
      if (raw) setSavedViews(JSON.parse(raw) as { name: string; columns: ColumnKey[] }[])
    } catch {
      /* ignore */
    }
  }, [eventSlug])

  const visibleCols = useMemo(() => columns.filter((c) => COLUMN_LABELS[c]), [columns])

  function persistViews(next: { name: string; columns: ColumnKey[] }[]) {
    setSavedViews(next)
    localStorage.setItem(viewsKey(eventSlug), JSON.stringify(next))
  }

  function saveCurrentView() {
    const name = viewName.trim()
    if (!name) return
    const next = [...savedViews.filter((v) => v.name !== name), { name, columns }]
    persistViews(next)
    setViewName('')
  }

  const columnTools = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="min-h-10 rounded-lg border border-dc-border px-3 py-2 text-dc-micro text-dc-muted hover:bg-dc-surface-muted"
        onClick={() => setShowChooser((v) => !v)}
      >
        Columns
      </button>
      {savedViews.map((v) => (
        <button
          key={v.name}
          type="button"
          className="min-h-10 rounded-lg border border-dc-border px-3 py-2 text-dc-micro hover:bg-dc-surface-muted"
          onClick={() => setColumns(v.columns)}
        >
          {v.name}
        </button>
      ))}
      <input
        className="min-h-10 min-w-0 flex-1 rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-dc-micro sm:max-w-[10rem]"
        placeholder="Save view as…"
        value={viewName}
        onChange={(e) => setViewName(e.target.value)}
      />
      <button
        type="button"
        className="min-h-10 rounded-lg bg-dc-accent-muted px-3 py-2 text-dc-micro font-medium text-dc-accent"
        onClick={saveCurrentView}
      >
        Save view
      </button>
    </div>
  )

  const detailPanel =
    selectedId && selectedRow ? (
      <aside
        id="organizer-registrant-detail"
        className="w-full shrink-0 rounded-xl border border-dc-border bg-dc-surface p-4 lg:sticky lg:top-4 lg:w-96"
      >
        {onClearSelection ? (
          <button
            type="button"
            className="mb-3 flex min-h-10 items-center gap-1 text-sm font-medium text-dc-accent hover:text-dc-accent-hover lg:hidden"
            onClick={onClearSelection}
          >
            <span aria-hidden>←</span> Back to list
          </button>
        ) : null}
        {(() => {
          const link = renderPersonRosterLink ? renderPersonRosterLink(selectedRow) : null
          return link ? <div className="mb-3 text-sm">{link}</div> : null
        })()}
        {renderDetail()}
      </aside>
    ) : null

  const mobileCards = (
    <ul className="space-y-2 lg:hidden" aria-label="Signups list">
      {rows.map((r) => {
        const active = selectedId === r.id
        return (
          <li key={r.id}>
            <div
              className={cn(
                'w-full cursor-pointer rounded-xl border border-dc-border bg-dc-elevated-solid p-4 text-left shadow-sm transition-colors',
                active && 'border-dc-accent-border bg-dc-accent-muted/40 ring-1 ring-dc-accent-border/50',
              )}
              onClick={() => onSelect(r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(r)
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-snug text-dc-text">{r.sceneDisplayName}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    {visibleCols.slice(0, 4).map((c) => (
                      <div key={c} className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted">
                          {COLUMN_LABELS[c]}
                        </dt>
                        <dd className="truncate text-dc-text">{getCell(r, c)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {!readOnly && renderCheckIn ? (
                  <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {renderCheckIn(r)}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}
      {!rows.length ? (
        <li className="rounded-xl border border-dashed border-dc-border px-4 py-8 text-center text-sm text-dc-muted">
          No registrants match filters.
        </li>
      ) : null}
    </ul>
  )

  const desktopTable = (
    <div className="hidden overflow-x-auto rounded-xl border border-dc-border lg:block">
      <table className="min-w-full text-left text-sm text-dc-text">
        <thead className="border-b border-dc-border bg-dc-surface-muted text-dc-micro uppercase text-dc-muted">
          <tr>
            <th className="px-3 py-2.5">Name</th>
            {visibleCols.map((c) => (
              <th key={c} className="px-3 py-2.5">
                {COLUMN_LABELS[c]}
              </th>
            ))}
            {!readOnly && renderCheckIn ? <th className="px-3 py-2.5">Check-in</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={cn(
                'cursor-pointer border-b border-dc-border/50 hover:bg-dc-surface-muted',
                selectedId === r.id && 'bg-dc-accent-muted/50',
              )}
              onClick={() => onSelect(r)}
            >
              <td className="px-3 py-2.5 font-medium">{r.sceneDisplayName}</td>
              {visibleCols.map((c) => (
                <td key={c} className="px-3 py-2.5 text-dc-muted">
                  {getCell(r, c)}
                </td>
              ))}
              {!readOnly && renderCheckIn ? (
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  {renderCheckIn(r)}
                </td>
              ) : null}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td
                colSpan={visibleCols.length + 1 + (renderCheckIn && !readOnly ? 1 : 0)}
                className="px-3 py-6 text-center text-dc-muted"
              >
                No registrants match filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )

  const showListOnMobile = !selectedId

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className={cn('min-w-0 flex-1 space-y-3', !showListOnMobile && 'hidden lg:block')}>
        {columnTools}
        {showChooser ? (
          <div className="flex flex-wrap gap-2 rounded-lg border border-dc-border bg-dc-surface-muted p-3 text-dc-micro">
            {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((c) => (
              <label key={c} className="flex min-h-10 items-center gap-2">
                <input
                  type="checkbox"
                  checked={columns.includes(c)}
                  onChange={(e) => {
                    setColumns((prev) => (e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)))
                  }}
                />
                {COLUMN_LABELS[c]}
              </label>
            ))}
          </div>
        ) : null}
        {mobileCards}
        {desktopTable}
      </div>

      {detailPanel}

      {!selectedId ? (
        <aside className="hidden w-96 shrink-0 rounded-xl border border-dashed border-dc-border bg-dc-elevated-muted/40 p-6 text-sm text-dc-muted lg:block">
          <p className="font-medium text-dc-text">Select a signup</p>
          <p className="mt-2 leading-relaxed">
            Review registration, vetting, check-in, answers, notes, tags, and payment metadata.
          </p>
        </aside>
      ) : null}
    </div>
  )
}
