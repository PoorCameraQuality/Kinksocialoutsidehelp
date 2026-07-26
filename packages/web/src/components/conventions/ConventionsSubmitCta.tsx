import { Link } from 'react-router-dom'

const SUBMIT_HREF = '/organizer'

type Props = {
  variant?: 'banner' | 'button'
  className?: string
}

export default function ConventionsSubmitCta({ variant = 'banner', className = '' }: Props) {
  if (variant === 'button') {
    return (
      <Link
        to={SUBMIT_HREF}
        className={`inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover ${className}`}
        title="Organizer onboarding required to publish a convention"
      >
        Submit Convention
      </Link>
    )
  }

  return (
    <section
      className={`mt-6 rounded-xl border border-dc-accent-border/40 bg-gradient-to-r from-dc-elevated-solid via-dc-surface-muted to-dc-elevated-solid px-4 py-4 text-center sm:mt-10 sm:rounded-2xl sm:p-6 md:p-8 ${className}`.trim()}
      aria-label="List your convention"
    >
      <h2 className="text-base font-semibold text-dc-text sm:text-lg">Want your convention listed?</h2>
      <p className="mx-auto mt-1.5 max-w-lg text-sm text-dc-text-muted">
        Publish your program and attendee hub through organizer tools.
      </p>
      <Link
        to={SUBMIT_HREF}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        title="Organizer onboarding required to publish a convention"
      >
        Submit Convention
      </Link>
    </section>
  )
}
