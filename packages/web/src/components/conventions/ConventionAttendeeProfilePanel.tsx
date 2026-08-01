import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { pickPrimaryProfilePhoto } from '@c2k/shared'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useApiMyProfileFeedPosts } from '@/hooks/useApiProfileFeedPosts'
import { buildLoginHref } from '@/lib/auth-links'
import type { ApiFeedPost } from '@/lib/feed-mapper'
import { buildProfileOnboardingHref } from '@/lib/profile-onboarding'

type RemoteProfileResponse = {
  user: { id: string; username: string }
  profile: {
    bio: string | null
    displayName: string | null
    pronouns: string | null
    roles: string[] | null
    avatarUrl?: string | null
  } | null
  photos?: Array<{ url?: string | null; order?: number }>
}

type Props = {
  /** Play Spaces: push kink.social profile completion. Convention: existing copy. */
  variant?: 'convention' | 'play-space'
}

function relativeWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function postSneakLine(post: ApiFeedPost): string {
  const title = post.title?.trim()
  if (title) return title
  const body = post.body?.replace(/\s+/g, ' ').trim()
  if (body) return body
  if (post.kind === 'repost') return 'Reposted something'
  return 'Shared an update'
}

export default function ConventionAttendeeProfilePanel({ variant = 'convention' }: Props) {
  const { pathname } = useLocation()
  const { viewerUsername, viewerDisplayName, isAuthenticated, isFallback } = useAuth()
  const [remote, setRemote] = useState<RemoteProfileResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const isPlay = variant === 'play-space'
  const activity = useApiMyProfileFeedPosts(isPlay && isAuthenticated && !isFallback, 3)

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
        <p>
          {isPlay
            ? 'Sign in with kink.social so partners see your real profile on Compare and share links.'
            : 'Sign in to show your convention profile card on Compare and scene requests.'}
        </p>
        <Link
          to={buildLoginHref(pathname)}
          className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-text"
        >
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
  const photos = (remote?.photos ?? [])
    .filter((p): p is { url: string; order: number } => Boolean(p.url?.trim()))
    .map((p, i) => ({ url: p.url!.trim(), order: typeof p.order === 'number' ? p.order : i }))
  const primaryPhoto = pickPrimaryProfilePhoto(photos) ?? photos[0]
  const photoUrl = primaryPhoto?.url?.trim() || remote?.profile?.avatarUrl?.trim() || null
  const thinProfile = !bio || !remote?.profile?.displayName?.trim()
  const editHref = buildProfileOnboardingHref(pathname)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dc-border bg-dc-elevated/95/60 p-4">
        <div className="flex flex-wrap items-start gap-4">
          {photoUrl ?
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-dc-border"
            />
          : <PlaceholderAvatar size="lg" className="shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-2xl text-dc-text">{displayName}</h3>
            <p className="text-sm text-dc-muted">@{viewerUsername}</p>
            {pronouns ? <p className="mt-1 text-sm text-dc-text-muted">{pronouns}</p> : null}
            {roles.length > 0 ?
              <p className="mt-2 text-xs text-dc-muted">{roles.join(' · ')}</p>
            : null}
            {bio ?
              <p className="mt-3 text-sm text-dc-text-muted line-clamp-4 whitespace-pre-wrap">{bio}</p>
            : (
              <p className="mt-3 text-sm text-dc-muted">No bio yet.</p>
            )}
          </div>
        </div>

        {isPlay ?
          <div className="mt-4 border-t border-dc-border pt-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Recent activity</p>
              {viewerUsername ?
                <Link
                  to={`/profile/${encodeURIComponent(viewerUsername)}`}
                  className="text-[11px] font-medium text-dc-accent hover:underline"
                >
                  Full profile
                </Link>
              : null}
            </div>
            {activity.status === 'loading' ?
              <p className="text-xs text-dc-muted">Loading…</p>
            : activity.status === 'error' ?
              <p className="text-xs text-dc-muted">Could not load recent posts.</p>
            : activity.items.length === 0 ?
              <p className="text-xs text-dc-muted">
                No recent posts yet.{' '}
                <Link to="/home" className="text-dc-accent hover:underline">
                  Share something
                </Link>
              </p>
            : (
              <ul className="space-y-1.5">
                {activity.items.map((post) => (
                  <li key={post.id}>
                    <Link
                      to={`/profile/${encodeURIComponent(viewerUsername ?? '')}`}
                      className="flex items-start justify-between gap-3 rounded-lg px-1 py-1 text-xs hover:bg-dc-surface-muted/50"
                    >
                      <span className="min-w-0 flex-1 truncate text-dc-text-muted">{postSneakLine(post)}</span>
                      <span className="shrink-0 tabular-nums text-dc-muted">{relativeWhen(post.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        : null}
      </div>

      {!isPlay ?
        <p className="text-xs text-dc-muted">
          Contact links and photo visibility follow your account settings and what organizers allow on the dancecard
          profile.
        </p>
      : null}

      <div className="flex flex-wrap gap-2">
        <Link
          to={editHref}
          className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          {isPlay ? (thinProfile ? 'Complete profile' : 'Edit profile') : 'Edit profile settings'}
        </Link>
        {viewerUsername ?
          <Link
            to={`/profile/${encodeURIComponent(viewerUsername)}`}
            className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            View public profile
          </Link>
        : null}
        {!isPlay ?
          <Link
            to="/settings"
            className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            Account settings
          </Link>
        : null}
      </div>
    </div>
  )
}
