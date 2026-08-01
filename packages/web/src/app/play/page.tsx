import { FormEvent, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createPlaySpace, useApiPlaySpaces } from '@/hooks/useApiPlaySpaces'
import { buildLoginHref } from '@/lib/auth-links'
import {
  appearanceVarsToStyle,
  getAppearancePreset,
  PLAY_SURFACE_APPEARANCE,
} from '@/lib/dancecard/appearancePresets'

function formatWindow(startsAt: string, endsAt: string): string {
  try {
    const s = new Date(startsAt)
    const e = new Date(endsAt)
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
    return `${s.toLocaleString(undefined, opts)} → ${e.toLocaleString(undefined, opts)}`
  } catch {
    return `${startsAt} → ${endsAt}`
  }
}

function defaultWindow() {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 24)
  const end = new Date(start)
  end.setHours(end.getHours() + 6)
  return {
    startsAt: start.toISOString().slice(0, 16),
    endsAt: end.toISOString().slice(0, 16),
  }
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-dc-border-strong bg-dc-surface-muted px-3 py-2 text-dc-text placeholder:text-dc-text-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent/40'

export default function PlaySpacesDirectoryPage() {
  const { isAuthenticated, status: authStatus } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'directory' | 'mine'>('directory')
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const defaults = useMemo(() => defaultWindow(), [])
  const theme = getAppearancePreset(PLAY_SURFACE_APPEARANCE)
  const themeStyle = useMemo(
    () => appearanceVarsToStyle(theme.vars, theme.mode),
    [theme],
  )

  const list = useApiPlaySpaces({
    mine: tab === 'mine',
    q: q.trim() || undefined,
    enabled: tab === 'directory' || (tab === 'mine' && isAuthenticated),
  })

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isAuthenticated) {
      navigate(buildLoginHref('/play'))
      return
    }
    const fd = new FormData(e.currentTarget)
    const title = String(fd.get('title') || '').trim()
    const locationLabel = String(fd.get('locationLabel') || '').trim()
    const description = String(fd.get('description') || '').trim()
    const visibility = String(fd.get('visibility') || 'public') as 'public' | 'unlisted' | 'private'
    const startsLocal = String(fd.get('startsAt') || '')
    const endsLocal = String(fd.get('endsAt') || '')
    setCreateError(null)
    setCreating(true)
    try {
      const space = await createPlaySpace({
        title,
        locationLabel: locationLabel || undefined,
        description: description || undefined,
        visibility,
        startsAt: new Date(startsLocal).toISOString(),
        endsAt: new Date(endsLocal).toISOString(),
      })
      navigate(`/play/${encodeURIComponent(space.slug)}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create play space')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="dc-gold-chrome dc-play-directory mx-auto max-w-3xl px-4 py-8 text-dc-text"
      data-dc-appearance={PLAY_SURFACE_APPEARANCE}
      data-dc-theme="event"
      style={themeStyle as CSSProperties}
    >
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-dc-accent">kink.social</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-dc-text">Play Spaces</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-text-muted">
          One play space per gathering. Join the host’s space to get your own dancecard — they set up
          program, map, and the shared window. Don’t create a second space for the same event.
        </p>
        <Link
          to="/play/schedule"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-dc-accent-border bg-dc-accent-muted px-4 text-sm font-semibold text-dc-accent-hover hover:bg-dc-accent hover:text-dc-accent-foreground"
        >
          My schedule &amp; exports
        </Link>
      </header>

      <section className="mb-6 rounded-2xl border border-dc-accent-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
        <h2 className="text-sm font-semibold text-dc-accent-hover">How it works</h2>
        <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-dc-text-muted">
          <li>
            <span className="font-medium text-dc-text">1. Find</span> the play space for your event
            (search below).
          </li>
          <li>
            <span className="font-medium text-dc-text">2. Join</span> — you get your own dancecard inside
            that space.
          </li>
          <li>
            <span className="font-medium text-dc-text">3. Hosts</span> own the infrastructure (program,
            map, invite). Everyone else just joins.
          </li>
        </ol>
      </section>

      <div className="mb-4 rounded-2xl border border-dc-border-subtle bg-dc-elevated-solid p-3 shadow-[var(--dc-shadow-soft)] sm:p-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-dc-text-muted">
          Find a play space to join
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by event name or place…"
          className="mt-1.5 w-full rounded-xl border border-dc-border-strong bg-dc-surface-muted px-4 py-3 text-base text-dc-text placeholder:text-dc-text-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent/40"
          autoComplete="off"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('directory')}
          className={`min-h-11 rounded-xl px-3.5 py-2 text-sm font-medium ${
            tab === 'directory' ?
              'bg-dc-accent text-dc-accent-foreground'
            : 'border border-dc-border-strong bg-dc-surface-muted text-dc-text-muted hover:text-dc-text'
          }`}
        >
          Join an event
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              navigate(buildLoginHref('/play'))
              return
            }
            setTab('mine')
          }}
          className={`min-h-11 rounded-xl px-3.5 py-2 text-sm font-medium ${
            tab === 'mine' ?
              'bg-dc-accent text-dc-accent-foreground'
            : 'border border-dc-border-strong bg-dc-surface-muted text-dc-text-muted hover:text-dc-text'
          }`}
        >
          My dancecards
        </button>
        {authStatus === 'ready' && !isAuthenticated && (
          <Link
            to={buildLoginHref('/play')}
            className="ml-auto min-h-11 rounded-xl border border-dc-border-strong bg-dc-surface-muted px-3.5 py-2 text-sm text-dc-text hover:border-dc-accent"
          >
            Sign in to join
          </Link>
        )}
      </div>

      {list.status === 'loading' && <p className="text-sm text-dc-text-muted">Loading…</p>}
      {list.status === 'error' && <p className="text-sm text-dc-danger">{list.errorMessage}</p>}
      {list.status === 'ready' && list.items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-dc-border-strong bg-dc-elevated-solid px-4 py-6 text-sm leading-relaxed text-dc-text-muted">
          {tab === 'mine' ?
            'You have not joined any play spaces yet. Search the directory and join the host’s space for your event.'
          : q.trim() ?
            'No matching play spaces. Double-check the name — if you’re not the host, ask them for the link or invite code instead of creating a new one.'
          : 'No upcoming public play spaces yet. If you’re hosting, you can create one below after checking that none exists.'}
        </p>
      )}
      {list.status === 'ready' && list.items.length > 0 && (
        <ul className="space-y-3">
          {list.items.map((space) => (
            <li key={space.id}>
              <Link
                to={`/play/${encodeURIComponent(space.slug)}`}
                className="dc-play-directory__card block rounded-2xl border border-dc-border-subtle bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)] transition hover:border-dc-accent-border hover:bg-dc-elevated-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-medium text-dc-text">{space.title}</h2>
                    {space.locationLabel && (
                      <p className="mt-0.5 text-sm text-dc-accent-hover">{space.locationLabel}</p>
                    )}
                    <p className="mt-1 text-xs text-dc-text-muted">
                      {formatWindow(space.startsAt, space.endsAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-dc-text-muted">
                      {space.memberCount} member{space.memberCount === 1 ? '' : 's'}
                    </div>
                    {space.isMember ?
                      <span className="mt-1 inline-block rounded-full bg-dc-accent-muted px-2.5 py-1 text-xs font-semibold text-dc-accent-hover ring-1 ring-dc-accent-border/50">
                        Your dancecard
                      </span>
                    : <span className="mt-1 inline-block rounded-full bg-dc-accent px-2.5 py-1 text-xs font-semibold text-dc-accent-foreground">
                        Join
                      </span>
                    }
                  </div>
                </div>
                {space.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-dc-text-muted">
                    {space.description}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-dc-text-muted">
                  {space.isMember ?
                    'Open your dancecard in this shared space'
                  : 'Join to get your own dancecard — same program & map as everyone else'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 border-t border-dc-border-subtle pt-6">
        <p className="text-sm leading-relaxed text-dc-text-muted">
          Hosting something new? Only create a play space if one doesn’t already exist for that event.
        </p>
        <button
          type="button"
          className="mt-2 min-h-11 text-sm font-medium text-dc-accent-hover underline-offset-2 hover:underline"
          onClick={() => {
            if (!isAuthenticated) {
              navigate(buildLoginHref('/play'))
              return
            }
            setShowCreate((v) => !v)
          }}
        >
          {showCreate ? 'Cancel' : 'I’m the host — create a play space'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={onCreate}
          className="mt-4 space-y-3 rounded-2xl border border-dc-border-subtle bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]"
        >
          <h2 className="text-lg font-medium text-dc-text">New play space</h2>
          <p className="text-xs leading-relaxed text-dc-text-muted">
            Creating makes you the owner of program, map, and invites. Attendees should join this space —
            not create their own copy.
          </p>
          <label className="block text-sm text-dc-text-muted">
            Title
            <input
              name="title"
              required
              minLength={2}
              placeholder="Summer camp 2026"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-dc-text-muted">
            Place / vibe
            <input
              name="locationLabel"
              placeholder="The Korral — upstairs lounge"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-dc-text-muted">
            Description
            <textarea name="description" rows={3} className={fieldClass} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-dc-text-muted">
              Starts
              <input
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={defaults.startsAt}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm text-dc-text-muted">
              Ends
              <input
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={defaults.endsAt}
                className={fieldClass}
              />
            </label>
          </div>
          <label className="block text-sm text-dc-text-muted">
            Visibility
            <select name="visibility" defaultValue="public" className={fieldClass}>
              <option value="public">Public — listed so people can find &amp; join</option>
              <option value="unlisted">Unlisted — invite link / code</option>
              <option value="private">Private — invite code required</option>
            </select>
          </label>
          {createError && <p className="text-sm text-dc-danger">{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="min-h-11 rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'Create as host'}
          </button>
        </form>
      )}
    </div>
  )
}
