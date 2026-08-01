import type { ReactNode } from 'react'

export default function IsoSection({
  id,
  title,
  hint,
  summary,
  open,
  onToggle,
  children,
  actionLabel,
}: {
  id: string
  title: string
  hint?: string
  summary?: string | null
  open: boolean
  onToggle: () => void
  children: ReactNode
  actionLabel?: string
}) {
  const collapsed = !open && Boolean(summary)

  return (
    <section id={`iso-section-${id}`} className="rounded-2xl border border-dc-border bg-dc-elevated/95">
      <h3 className="sr-only" id={`${id}-heading`}>
        {title}
      </h3>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="flex min-h-14 w-full items-start gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--dc-accent)]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-dc-text">{title}</p>
          {collapsed ?
            <p className="mt-1 text-[14px] leading-snug text-dc-text-muted whitespace-pre-line">{summary}</p>
          : hint ?
            <p className="mt-0.5 text-[13px] leading-relaxed text-dc-muted">{hint}</p>
          : null}
        </div>
        <span className="shrink-0 pt-0.5 text-[13px] font-medium text-dc-accent">
          {open ? 'Close' : actionLabel ?? (collapsed ? 'Edit' : 'Open')}
        </span>
      </button>
      {open ?
        <div id={`${id}-panel`} className="space-y-4 border-t border-dc-border px-4 py-4" role="region" aria-labelledby={`${id}-heading`}>
          {children}
        </div>
      : null}
    </section>
  )
}
