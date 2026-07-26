import { Link } from 'react-router-dom'
import { cardSurfaceSolidClass } from '@/lib/card-surface'

export default function NotificationsSafetyFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`${cardSurfaceSolidClass} p-3 sm:p-4 ${className}`.trim()}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent-muted text-dc-accent"
            aria-hidden
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </span>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Only share what you&apos;re comfortable with. You can report abuse or block someone anytime. Meeting IRL?
            Use a public place first and tell a friend your plans.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-4 text-sm font-medium">
          <Link to="/support" className="text-dc-accent hover:underline">
            Help &amp; support
          </Link>
          <Link to="/support" className="text-dc-accent hover:underline">
            Report a problem
          </Link>
        </div>
      </div>
    </footer>
  )
}
