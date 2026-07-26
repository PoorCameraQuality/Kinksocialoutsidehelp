import type { ReactNode } from 'react'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

type Props<T> = {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
}

export default function OrganizerDataTable<T>({ columns, rows, rowKey, emptyMessage = 'No rows yet.' }: Props<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-dc-muted py-4">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-dc-border text-xs uppercase tracking-wide text-dc-muted">
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2 font-medium ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-dc-border-subtle hover:bg-white/[0.02]">
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2.5 align-middle ${col.className ?? ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
