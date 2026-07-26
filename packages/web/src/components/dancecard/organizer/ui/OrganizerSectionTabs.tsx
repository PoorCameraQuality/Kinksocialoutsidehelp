'use client'

import { cn } from '@/lib/cn'

export type OrganizerSectionTab = {
  id: string
  label: string
}

type Props = {
  tabs: readonly OrganizerSectionTab[]
  activeId: string
  onChange: (id: string) => void
  /** Shown above controls so users know these switch views, not tags. */
  heading?: string
  ariaLabel?: string
  className?: string
}

/**
 * Section switcher for organizer hubs (e.g. People → Signups / Staff / …).
 * Mobile: full-width select. Desktop: underline tablist.
 */
export function OrganizerSectionTabs({
  tabs,
  activeId,
  onChange,
  heading = 'Switch section',
  ariaLabel = 'Page sections',
  className = '',
}: Props) {
  const activeLabel = tabs.find((t) => t.id === activeId)?.label ?? activeId

  return (
    <div className={cn('rounded-xl border border-dc-border bg-dc-elevated-muted/60 p-3 sm:p-4', className)}>
      <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">{heading}</p>

      <label className="mt-3 flex flex-col gap-1.5 md:hidden">
        <span className="sr-only">{ariaLabel}</span>
        <span className="text-xs text-dc-muted">Current: {activeLabel}</span>
        <select
          className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-4 py-3 text-base font-medium text-dc-text shadow-sm"
          value={activeId}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
        >
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div
        role="tablist"
        aria-label={ariaLabel}
        className="mt-3 hidden gap-0.5 overflow-x-auto border-b border-dc-border [-ms-overflow-style:none] [scrollbar-width:none] md:flex md:flex-wrap [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const active = activeId === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`organizer-section-${t.id}`}
              id={`organizer-section-tab-${t.id}`}
              className={cn(
                'relative shrink-0 px-3 py-2.5 text-left text-sm font-medium transition-colors sm:px-4',
                active
                  ? 'text-dc-accent'
                  : 'text-dc-muted hover:text-dc-text',
              )}
              onClick={() => onChange(t.id)}
            >
              <span className="block max-w-[14rem] truncate sm:max-w-none">{t.label}</span>
              {active ? (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-dc-accent"
                  aria-hidden
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
