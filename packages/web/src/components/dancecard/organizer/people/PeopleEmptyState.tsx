'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Action = {
  label: string
  onClick?: () => void
  href?: string
  primary?: boolean
}

export function PeopleEmptyState({
  title,
  children,
  actions = [],
  className,
}: {
  title: string
  children: ReactNode
  actions?: Action[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-dc-border bg-dc-elevated-muted/40 px-6 py-10 text-center',
        className,
      )}
    >
      <h3 className="font-serif text-lg text-dc-text">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-dc-muted">{children}</p>
      {actions.length ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actions.map((a) => {
            const cls = a.primary
              ? 'rounded-xl bg-dc-accent px-4 py-2.5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover'
              : 'rounded-xl border border-dc-border px-4 py-2.5 text-sm font-medium text-dc-text hover:bg-dc-surface-muted'
            if (a.href) {
              return (
                <a key={a.label} href={a.href} className={cls}>
                  {a.label}
                </a>
              )
            }
            return (
              <button key={a.label} type="button" className={cls} onClick={a.onClick}>
                {a.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
