import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchPlaySpace,
  joinPlaySpace,
  type PlaySpaceListItem,
} from '@/hooks/useApiPlaySpaces'
import { buildLoginHref } from '@/lib/auth-links'
import PlaySpaceDancecardShell from '@/components/play/PlaySpaceDancecardShell'
import PlaySpaceOwnerDetailsForm from '@/components/play/PlaySpaceOwnerDetailsForm'
import {
  appearanceVarsToStyle,
  getAppearancePreset,
  PLAY_SURFACE_APPEARANCE,
} from '@/lib/dancecard/appearancePresets'

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function PlaySpaceDetailPage() {
  const { slug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [space, setSpace] = useState<PlaySpaceListItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState(searchParams.get('code') ?? '')
  const [busy, setBusy] = useState(false)

  const theme = getAppearancePreset(PLAY_SURFACE_APPEARANCE)
  const themeStyle = appearanceVarsToStyle(theme.vars, theme.mode)

  const load = useCallback(async () => {
    if (!slug) return
    setError(null)
    try {
      setSpace(await fetchPlaySpace(slug))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load play space')
      setSpace(null)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  async function onJoin() {
    if (!isAuthenticated) {
      navigate(buildLoginHref(`/play/${slug}`))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await joinPlaySpace(slug, inviteCode.trim() || undefined)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join')
    } finally {
      setBusy(false)
    }
  }

  if (error && !space) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link to="/play" className="text-sm text-dc-accent hover:underline">
          ← Play Spaces
        </Link>
        <p className="mt-4 text-red-300">{error}</p>
      </div>
    )
  }

  if (!space) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-dc-muted">Loading…</p>
      </div>
    )
  }

  const isOwner = space.myRole === 'owner'

  return (
    <div
      className="dc-gold-chrome mx-auto max-w-5xl px-3 py-4 text-dc-text sm:px-4 sm:py-8"
      data-dc-appearance={PLAY_SURFACE_APPEARANCE}
      data-dc-theme="event"
      style={themeStyle as CSSProperties}
    >
      <Link to="/play" className="text-sm text-dc-accent hover:underline">
        ← Play Spaces
      </Link>

      <header className="mt-3 mb-4 sm:mt-4 sm:mb-6">
        <h1 className="font-serif text-2xl leading-tight text-dc-text sm:text-4xl">{space.title}</h1>
        {space.locationLabel ?
          <p className="mt-0.5 truncate text-sm text-dc-text-muted sm:mt-1">{space.locationLabel}</p>
        : null}
        <p className="mt-1 text-xs text-dc-muted sm:mt-2 sm:text-sm">
          {formatWhen(space.startsAt)} → {formatWhen(space.endsAt)}
          <span className="text-dc-muted/80">
            {' '}
            · {space.memberCount} member{space.memberCount === 1 ? '' : 's'}
          </span>
        </p>
        {space.description?.trim() ?
          <p className="mt-2 text-sm leading-snug text-dc-accent-hover sm:mt-3 sm:text-base">
            {space.description.trim()}
          </p>
        : isOwner ?
          <p className="mt-2 text-sm text-dc-muted sm:mt-3">No description yet — add one so joiners know the vibe.</p>
        : null}
        {isOwner && space.inviteCode ?
          <p className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-dc-accent/30 bg-dc-accent/10 px-3 py-1.5 text-xs text-dc-text sm:mt-3 sm:text-sm">
            Invite <code className="font-mono text-dc-accent">{space.inviteCode}</code>
          </p>
        : null}
        {isOwner ?
          <PlaySpaceOwnerDetailsForm
            space={space}
            slug={slug}
            onSaved={(next) => {
              setSpace(next)
            }}
          />
        : null}
        {space.isMember ?
          <div className="mt-3">
            <Link
              to="/play/schedule"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-accent-border bg-dc-accent-muted px-4 text-sm font-semibold text-dc-accent-hover hover:bg-dc-accent hover:text-dc-accent-foreground"
            >
              My schedule &amp; exports
            </Link>
          </div>
        : null}
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      {!space.isMember ?
        <section className="mb-8 rounded-2xl border border-dc-border bg-dc-elevated/80 p-4">
          <h2 className="font-serif text-xl text-dc-text">Join for your dancecard</h2>
          <p className="mt-1 text-sm text-dc-muted">
            Join this host’s space — you get your own dancecard. Don’t create another for the same event.
          </p>
          {(space.visibility === 'private' || space.visibility === 'unlisted') && (
            <label className="mt-3 block text-sm text-dc-text">
              Invite code
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
              />
            </label>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void onJoin()}
            className="mt-3 rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-60"
          >
            {isAuthenticated ? 'Join' : 'Sign in to join'}
          </button>
        </section>
      : null}

      {space.isMember ?
        <PlaySpaceDancecardShell space={space} slug={slug} isOwner={isOwner} onRefreshSpace={() => void load()} />
      : null}
    </div>
  )
}
