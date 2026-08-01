import { useEffect, useRef } from 'react'
import type { ProgramDay } from '@/lib/play-space-program'

export default function PlaySpaceProgramDayNav({
  days,
  selectedKey,
  onSelect,
  variant = 'chips',
}: {
  days: ProgramDay[]
  selectedKey: string | null
  onSelect: (dayKey: string) => void
  variant?: 'chips' | 'rail'
}) {
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  useEffect(() => {
    if (!selectedKey || variant !== 'chips') return
    const el = btnRefs.current.get(selectedKey)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedKey, variant])

  if (days.length === 0) return null

  if (variant === 'rail') {
    return (
      <nav className="hidden w-[180px] shrink-0 lg:block" aria-label="Program days">
        <ul className="space-y-1">
          {days.map((d) => {
            const selected = d.dayKey === selectedKey
            return (
              <li key={d.dayKey}>
                <button
                  type="button"
                  aria-current={selected ? 'date' : undefined}
                  onClick={() => onSelect(d.dayKey)}
                  className={`flex min-h-11 w-full flex-col items-start justify-center rounded-xl border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dc-surface)] ${
                    selected
                      ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_12%,var(--dc-elevated))] font-semibold text-dc-text'
                      : 'border-transparent text-dc-text-muted hover:border-dc-border hover:bg-dc-elevated'
                  }`}
                >
                  {d.isToday ? (
                    <>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-dc-accent">Today</span>
                      <span>{d.shortLabel.replace(/^Today · /, '')}</span>
                    </>
                  ) : (
                    <span>{d.shortLabel}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    )
  }

  return (
    <div
      className="sticky top-[3.75rem] z-10 -mx-1 flex gap-2 overflow-x-auto bg-dc-surface/95 px-1 py-2 backdrop-blur-md [scrollbar-width:none] md:top-0 lg:hidden [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Program days"
    >
      {days.map((d) => {
        const selected = d.dayKey === selectedKey
        return (
          <button
            key={d.dayKey}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-current={selected ? 'date' : undefined}
            ref={(el) => {
              if (el) btnRefs.current.set(d.dayKey, el)
              else btnRefs.current.delete(d.dayKey)
            }}
            onClick={() => onSelect(d.dayKey)}
            className={`min-h-11 shrink-0 rounded-full border px-3.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dc-surface)] ${
              selected
                ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_12%,var(--dc-elevated))] font-semibold text-dc-text'
                : 'border-dc-border bg-dc-elevated text-dc-text-muted'
            }`}
          >
            {d.shortLabel}
          </button>
        )
      })}
    </div>
  )
}
