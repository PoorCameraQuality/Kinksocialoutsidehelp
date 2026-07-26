import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'

type RemoteProfileResponse = {
  user: { id: string; username: string }
  profile: {
    bio: string | null
    displayName: string | null
    pronouns: string | null
    roles: string[] | null
  } | null
}

export default function ConventionAttendeeProfilePanel() {
  const { viewerUsername, viewerDisplayName, isAuthenticated, isFallback } = useAuth()
  const [remote, setRemote] = useState<RemoteProfileResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!viewerUsername || !isAuthenticated || isFallback) {
      setRemote(null)
      setErr(null)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/profile/${encodeURIComponent(viewerUsername)}`, { credentials: 'include' })
      if (!r.ok) {
        setRemote(null)
        setErr('Could not load profile.')
        return
      }
      setRemote((await r.json()) as RemoteProfileResponse)
    } catch {
      setRemote(null)
      setErr('Network error loading profile.')
    } finally {
      setLoading(false)
    }
  }, [viewerUsername, isAuthenticated, isFallback])

  useEffect(() => {
    void load()
  }, [load])

  if (!isAuthenticated || isFallback) {
    return (
      <div className="space-y-3 text-sm text-dc-text-muted">
        <p>Sign in to show your convention profile card on Compare and scene requests.</p>
        <Link to={buildLoginHref()} className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-text">
          Sign in
        </Link>
      </div>
    )
  }

  if (loading) return <p className="text-sm text-dc-muted">Loading profile…</p>
  if (err) return <p className="text-sm text-red-300">{err}</p>

  const displayName =
    remote?.profile?.displayName?.trim() || viewerDisplayName?.trim() || viewerUsername || 'You'
  const bio = remote?.profile?.bio?.trim()
  const pronouns = remote?.profile?.pronouns?.trim()
  const roles = remote?.profile?.roles?.filter(Boolean) ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-dc-border bg-dc-elevated/95/60 p-4">
        <PlaceholderAvatar size="lg" className="shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Your card</p>
          <h3 className="font-serif text-2xl text-dc-text">{displayName}</h3>
          <p className="text-sm text-dc-muted">@{viewerUsername}</p>
          {pronouns ? <p className="mt-1 text-sm text-dc-text-muted">{pronouns}</p> : null}
          {roles.length > 0 ?
            <p className="mt-2 text-xs text-dc-muted">{roles.join(' · ')}</p>
          : null}
          {bio ?
            <p className="mt-3 text-sm text-dc-text-muted line-clamp-4 whitespace-pre-wrap">{bio}</p>
          : <p className="mt-3 text-sm text-dc-muted">No bio yet. Add one so partners recognize you on Compare.</p>}
        </div>
      </div>
      <p className="text-xs text-dc-muted">
        Contact links and photo visibility follow your account settings and what organizers allow on the dancecard profile.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/settings"
          className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-text hover:bg-dc-accent-hover"
        >
          Edit profile settings
        </Link>
        {viewerUsername ?
          <Link
            to={`/profile/${encodeURIComponent(viewerUsername)}`}
            className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            View full profile
          </Link>
        : null}
      </div>
    </div>
  )
}
