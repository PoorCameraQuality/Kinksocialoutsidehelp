import type { ReactNode } from 'react'

type Props = {
  left?: ReactNode
  right?: ReactNode
}

export default function OrganizerStatusBar({ left, right }: Props) {
  if (!left && !right) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dc-border bg-black/30 px-4 py-2 text-xs text-dc-muted">
      <div className="flex flex-wrap items-center gap-3">{left}</div>
      <div className="flex flex-wrap items-center gap-3">{right}</div>
    </div>
  )
}
