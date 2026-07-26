import { Link } from 'react-router-dom'
import PlaceholderPanel from '@/components/ui/PlaceholderPanel'

type Cta = { label: string; href: string }

/**
 * Consistent “coming soon” shell for placeholder routes (audit §4.4 / §4.6).
 */
export default function ComingSoonLayout({
  heading,
  body,
  primaryCta = { label: 'Browse events', href: '/events' },
  secondaryCta = { label: 'Back to home', href: '/home' },
}: {
  heading: string
  body: string
  primaryCta?: Cta | null
  secondaryCta?: Cta | null
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-dc-text mb-6">{heading}</h1>
      <PlaceholderPanel title="Coming soon" description={body}>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {primaryCta && (
            <Link
              to={primaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover"
            >
              {primaryCta.label}
            </Link>
          )}
          {secondaryCta && (
            <Link
              to={secondaryCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
        <nav
          aria-label="Explore live features"
          className="mt-8 border-t border-dc-border pt-6 text-center"
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-dc-muted">
            Explore live features
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {[
              { href: '/events', label: 'Events' },
              { href: '/groups', label: 'Groups' },
              { href: '/home', label: 'Home feed' },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border bg-dc-surface px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PlaceholderPanel>
    </div>
  )
}
