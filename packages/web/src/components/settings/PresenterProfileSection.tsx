import { Link } from 'react-router-dom'

import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useApiPresenterMe } from '@/hooks/useApiPresenterMe'
import { inferTrackFromFocuses } from '@/lib/presenter-onboarding'

const TRACK_LINKS = [
  { track: 'educator', label: 'Educator' },
  { track: 'speaker', label: 'Speaker' },
  { track: 'author', label: 'Author' },
  { track: 'photographer', label: 'Photographer' },
  { track: 'hybrid', label: 'Hybrid' },
] as const

export default function PresenterProfileSection() {
  const { isAuthenticated, viewerUsername } = useAuth()
  const api = useApiPresenterMe(isAuthenticated)

  if (!isAuthenticated) return null

  if (api.status === 'loading' || api.status === 'idle') {
    return (
      <Panel>
        <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" aria-label="Loading presenter profile" />
      </Panel>
    )
  }

  if (!api.profile) {
    return (
      <Panel id="presenter-catalog" className="scroll-mt-24 space-y-4">
        <SectionHeader
          eyebrow="Professional profile"
          title="Presenter & roles"
          description="Build an educator, speaker, author, or photographer profile that organizers can browse when planning programs."
        />
        <p className="text-sm text-dc-text-muted">
          Use the step-by-step setup wizard to add your headline, bio, offerings, gallery, and directory visibility — the
          same guided flow as setting up a vendor shop.
        </p>
        <Link
          to="/presenters/onboarding"
          className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Set up your professional profile
        </Link>
      </Panel>
    )
  }

  const profile = api.profile
  const inferredTrack = inferTrackFromFocuses(api.profileFocuses)
  const onboardingHref =
    inferredTrack ? `/presenters/onboarding?track=${inferredTrack}` : '/presenters/onboarding'
  const visibilityLabel =
    profile.directoryVisibility === 'PUBLIC' ?
      'Public — listed in the directory'
    : 'Unlisted — direct link only; not in directory'
  const headline = profile.headline?.trim() || 'No headline yet'
  const setupIncomplete = !profile.headline?.trim() || profile.directoryVisibility !== 'PUBLIC'

  return (
    <Panel id="presenter-catalog" className="scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader
          eyebrow="Professional profile"
          title="Presenter & roles"
          description="Manage your professional profile, offerings, and how you appear in the community directory."
        />
        {viewerUsername ?
          <Link
            to={`/presenters/${encodeURIComponent(viewerUsername)}`}
            className="shrink-0 text-sm text-dc-accent hover:underline"
          >
            View public page →
          </Link>
        : null}
      </div>

      <dl className="grid gap-3 rounded-xl border border-dc-border bg-dc-surface-muted/40 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-dc-muted">Headline</dt>
          <dd className="mt-0.5 font-medium text-dc-text">{headline}</dd>
        </div>
        <div>
          <dt className="text-xs text-dc-muted">Directory visibility</dt>
          <dd className="mt-0.5 text-dc-text">{visibilityLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-dc-muted">Offerings</dt>
          <dd className="mt-0.5 text-dc-text">{api.offerings.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-dc-muted">Gallery images</dt>
          <dd className="mt-0.5 text-dc-text">{api.gallery.length}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Link
          to={onboardingHref}
          className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          {setupIncomplete ? 'Continue setup wizard' : 'Open setup wizard'}
        </Link>
        <Link
          to="/presenters/onboarding"
          className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
        >
          Change profile type
        </Link>
      </div>

      <p className="text-xs leading-relaxed text-dc-muted">
        Headline, bio, links, offerings, gallery, and visibility are managed in the setup wizard — not on this page.
        Pick a track to start over or extend your profile:
      </p>
      <p className="text-xs text-dc-muted">
        {TRACK_LINKS.map(({ track, label }, index) => (
          <span key={track}>
            {index > 0 ? ' · ' : null}
            <Link to={`/presenters/onboarding?track=${track}`} className="font-medium text-dc-accent hover:underline">
              {label}
            </Link>
          </span>
        ))}
        {' · '}
        <Link to="/education/write" className="font-medium text-dc-accent hover:underline">
          Write an educator article
        </Link>
      </p>
    </Panel>
  )
}
