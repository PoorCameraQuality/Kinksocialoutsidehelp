import { Link } from 'react-router-dom'

const HUB_LINKS = [
  { href: '/profile/edit', label: 'Edit profile', description: 'Bio, photos, and identity' },
  { href: '/settings/account', label: 'Account', description: 'Email, password, and sign-in' },
  { href: '/settings/privacy', label: 'Privacy', description: 'Who can see your profile and activity' },
  { href: '/settings/notifications', label: 'Notifications', description: 'Email and in-app alerts' },
  { href: '/settings/blocked', label: 'Safety', description: 'Blocked accounts and muted users' },
] as const

function HubLinkGrid() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {HUB_LINKS.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className="dc-card-polish flex min-h-touch flex-col justify-center rounded-xl border border-white/[0.07] bg-gradient-to-br from-dc-elevated-solid to-dc-elevated/80 px-4 py-3.5 transition-colors hover:border-dc-accent-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
        >
          <span className="text-sm font-semibold text-dc-text">{item.label}</span>
          <span className="text-xs text-dc-muted">{item.description}</span>
        </Link>
      ))}
    </div>
  )
}

/** Quick links for the Me tab — collapsed on mobile below profile tools. */
export default function ProfileMeHub() {
  return (
    <section className="mt-8 border-t border-white/[0.06] pt-6 lg:mt-10 lg:pt-8" aria-label="Account hub">
      <details className="group lg:hidden">
        <summary className="cursor-pointer list-none rounded-xl border border-dc-border bg-dc-elevated-muted/40 px-4 py-3 text-sm font-medium text-dc-text [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Account &amp; settings
            <span className="text-xs font-normal text-dc-muted group-open:hidden">Show</span>
            <span className="hidden text-xs font-normal text-dc-muted group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="mt-3">
          <HubLinkGrid />
        </div>
      </details>

      <div className="hidden lg:block">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Your account</h2>
          <Link
            to="/profile/edit"
            className="inline-flex min-h-touch items-center text-xs font-semibold text-dc-accent hover:underline"
          >
            Edit profile
          </Link>
        </div>
        <HubLinkGrid />
      </div>
    </section>
  )
}
