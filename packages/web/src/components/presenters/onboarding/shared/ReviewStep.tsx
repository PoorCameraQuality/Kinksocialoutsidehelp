import { Link } from 'react-router-dom'
import type { PresenterOnboardingTrack } from '@/lib/presenter-focus'
import { formatProfileFocusLabels, PRESENTER_TRACK_LABELS } from '@/lib/presenter-focus'
import type { ProfileFocus } from '@/lib/presenter-focus'
import { StepNav } from './OnboardingShell'

type Props = {
  track: PresenterOnboardingTrack
  profileFocuses: ProfileFocus[]
  primaryProfileFocus: ProfileFocus | null
  headline: string
  visibility: string
  offeringCount: number
  galleryCount: number
  onBack: () => void
  onContinue: () => void
}

export default function ReviewStep({
  track,
  profileFocuses,
  primaryProfileFocus,
  headline,
  visibility,
  offeringCount,
  galleryCount,
  onBack,
  onContinue,
}: Props) {
  const roleLabel = formatProfileFocusLabels(profileFocuses, primaryProfileFocus) ?? PRESENTER_TRACK_LABELS[track]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-dc-text">Review your profile</h2>
      <dl className="space-y-3 rounded-xl border border-dc-border bg-dc-elevated-solid p-4 text-sm">
        <div>
          <dt className="text-dc-text-muted">Profile type</dt>
          <dd className="font-medium text-dc-text">{roleLabel}</dd>
        </div>
        <div>
          <dt className="text-dc-text-muted">Headline</dt>
          <dd className="text-dc-text">{headline || '—'}</dd>
        </div>
        <div>
          <dt className="text-dc-text-muted">Visibility</dt>
          <dd className="text-dc-text">{visibility === 'PUBLIC' ? 'Public directory' : 'Unlisted'}</dd>
        </div>
        <div>
          <dt className="text-dc-text-muted">Catalog entries</dt>
          <dd className="text-dc-text">{offeringCount}</dd>
        </div>
        {galleryCount > 0 ?
          <div>
            <dt className="text-dc-text-muted">Gallery images</dt>
            <dd className="text-dc-text">{galleryCount}</dd>
          </div>
        : null}
      </dl>
      <p className="text-xs text-dc-text-muted">You can edit this later in settings.</p>
      <StepNav onBack={onBack} onNext={onContinue} nextLabel="Finish setup" />
    </div>
  )
}

type DoneProps = {
  track: PresenterOnboardingTrack
  profileFocuses: ProfileFocus[]
  viewerUsername: string | null
}

export function DoneStep({ track, profileFocuses, viewerUsername }: DoneProps) {
  const showWrite = track === 'author' || track === 'educator' || track === 'hybrid'
  const showConventions = track !== 'author' || profileFocuses.includes('EDUCATOR')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-dc-text">Your professional profile is ready</h2>
      <p className="text-sm text-dc-text-muted">
        Convention applications and program slots happen separately when organizers open calls — not during profile
        setup.
      </p>
      {viewerUsername ?
        <Link
          to={`/presenters/${encodeURIComponent(viewerUsername)}`}
          className="flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          View profile
        </Link>
      : null}
      <Link
        to="/settings/ecosystem"
        className="flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
      >
        Edit advanced catalog
      </Link>
      {showConventions ?
        <Link
          to="/conventions"
          className="block text-center text-sm text-dc-accent hover:underline"
        >
          Browse conventions
        </Link>
      : null}
      {track === 'photographer' ?
        <Link to="/orgs" className="block text-center text-sm text-dc-accent hover:underline">
          Browse organizations
        </Link>
      : null}
      {showWrite ?
        <Link
          to="/education/write"
          className="flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
        >
          Write education content
        </Link>
      : null}
      {track === 'author' ?
        <Link to="/presenters" className="block text-center text-sm text-dc-accent hover:underline">
          Browse presenter directory
        </Link>
      : null}
    </div>
  )
}
