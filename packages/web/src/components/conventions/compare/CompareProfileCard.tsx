import { Link } from 'react-router-dom'

export type CompareProfile = {
  displayName: string
  username: string
  pronouns?: string | null
  bio?: string | null
  avatarUrl?: string | null
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function CompareProfileCard({
  profile,
  variant,
}: {
  profile: CompareProfile
  variant: 'self' | 'host'
}) {
  const ring =
    variant === 'host'
      ? 'ring-[1.5px] ring-dc-accent/50'
      : 'ring-[1.5px] ring-emerald-400/40'
  const profileHref = `/profile/${encodeURIComponent(profile.username)}`

  return (
    <article className="relative overflow-hidden rounded-2xl border border-dc-border bg-gradient-to-br from-dc-elevated via-dc-surface-muted to-dc-surface p-3 sm:p-4">
      <div className="relative flex items-stretch gap-3 sm:gap-4">
        <Link
          to={profileHref}
          className={`relative block w-[4.75rem] shrink-0 overflow-hidden rounded-xl sm:w-32 ${ring}`}
          aria-label={`@${profile.username} profile`}
        >
          {profile.avatarUrl ?
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          : <div
              className="flex h-full min-h-[5.25rem] w-full items-center justify-center bg-gradient-to-br from-dc-accent/35 to-dc-accent/10 text-base font-semibold text-dc-accent sm:min-h-32 sm:text-lg"
              aria-hidden
            >
              {initials(profile.displayName)}
            </div>
          }
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-dc-muted">
            {variant === 'host' ? 'Comparing with' : 'Your dancecard'}
          </p>
          <h2 className="font-serif text-lg leading-tight text-dc-text sm:text-xl">
            <Link to={profileHref} className="hover:text-dc-accent">
              {profile.displayName}
            </Link>
          </h2>
          <p className="text-xs text-dc-muted">
            <Link to={profileHref} className="hover:text-dc-accent">
              @{profile.username}
            </Link>
            {profile.pronouns ? <span className="text-dc-text/80"> · {profile.pronouns}</span> : null}
          </p>
          {profile.bio ?
            <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-dc-text-muted sm:mt-2 sm:line-clamp-3">
              {profile.bio}
            </p>
          : null}
          <Link
            to={profileHref}
            className="mt-1.5 hidden text-xs font-medium text-dc-accent hover:underline sm:mt-2 sm:inline-block"
          >
            kink.social profile
          </Link>
        </div>
      </div>
    </article>
  )
}
