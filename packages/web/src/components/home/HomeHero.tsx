import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

type Props = {
  onComposeClick?: () => void
}

export default function HomeHero({ onComposeClick }: Props) {
  const { viewerUsername, viewerDisplayName, isAuthenticated, isFallback } = useAuth()
  const hour = new Date().getHours()
  const greeting = greetingForHour(hour)
  const name = viewerDisplayName ?? viewerUsername ?? 'there'
  const signedIn = isAuthenticated && !isFallback

  return (
    <header
      className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between dc-panel-enter"
      aria-label="Home welcome"
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-dc-text sm:text-2xl">
          {greeting}
          {signedIn || viewerUsername ?
            <>
              · <span className="text-dc-accent">{name}</span>
            </>
          : null}
        </h1>
        {signedIn ?
          null
        : <p className="mt-1 text-sm text-dc-muted">Sign in to post and follow people.</p>}
      </div>

      {signedIn && onComposeClick ?
        <button
          type="button"
          onClick={onComposeClick}
          className="inline-flex min-h-10 shrink-0 items-center justify-center self-start rounded-xl bg-dc-accent px-5 text-sm font-medium text-dc-accent-foreground transition-colors hover:bg-dc-accent-hover sm:self-center"
        >
          New post
        </button>
      : !signedIn ?
        <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-center">
          <Link
            to={buildLoginHref('/home')}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Sign in
          </Link>
          <Link
            to="/discovery"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
          >
            Discovery
          </Link>
        </div>
      : null}
    </header>
  )
}
