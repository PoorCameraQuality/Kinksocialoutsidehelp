import type { ReactNode } from 'react'

export function OrgHubSectionCard({
  title,
  eyebrow,
  description,
  children,
  className = '',
}: {
  title?: string
  eyebrow?: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-dc-border bg-dc-elevated/95 p-5 sm:p-6 shadow-[var(--dc-shadow-soft)] ${className}`.trim()}
    >
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dc-muted">{eyebrow}</p>
      ) : null}
      {title ? (
        <h2 className={`text-lg font-semibold text-dc-text ${eyebrow ? 'mt-1' : ''}`}>{title}</h2>
      ) : null}
      {description ? <p className="mt-2 text-sm leading-relaxed text-dc-muted">{description}</p> : null}
      <div className={title || description || eyebrow ? 'mt-4' : undefined}>{children}</div>
    </section>
  )
}

export function OrgHubStatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'enabled' | 'disabled' | 'public' | 'members' | 'neutral'
  children: ReactNode
}) {
  const toneClass =
    tone === 'enabled'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
      : tone === 'disabled'
        ? 'border-dc-border bg-dc-elevated-muted text-dc-muted'
        : tone === 'public'
          ? 'border-sky-500/35 bg-sky-500/10 text-sky-200'
          : tone === 'members'
            ? 'border-amber-500/35 bg-amber-500/10 text-amber-100'
            : 'border-dc-border bg-dc-elevated-muted text-dc-text-muted'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}
    >
      {children}
    </span>
  )
}
