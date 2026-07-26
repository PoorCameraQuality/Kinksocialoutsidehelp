import type { ConventionOfficialLink } from '@/lib/convention-description'

type Props = {
  links: ConventionOfficialLink[]
  title?: string
  className?: string
  /** Flatter rows for nested sidebar cards. */
  compact?: boolean
}

function ExternalIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-dc-text/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M14 4h6v6M10 14 20 4M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ConventionOfficialLinks({
  links,
  title = 'Official links',
  className = '',
  compact = false,
}: Props) {
  if (!links.length) return null
  return (
    <section className={className} aria-label={title}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc-muted">{title}</p>
      <ul className={`mt-2.5 flex flex-col ${compact ? 'gap-1' : 'gap-2'}`}>
        {links.map((link) => (
          <li key={`${link.kind}:${link.href}`}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={
                compact ?
                  'inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-dc-text/90 transition hover:bg-dc-elevated-muted hover:text-dc-text'
                : 'inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-dc-border bg-dc-elevated-muted/40 px-3 py-2 text-sm font-medium text-dc-text transition hover:border-dc-accent-border/40 hover:bg-dc-elevated-muted'
              }
            >
              <span className="truncate">{link.label}</span>
              <ExternalIcon />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
