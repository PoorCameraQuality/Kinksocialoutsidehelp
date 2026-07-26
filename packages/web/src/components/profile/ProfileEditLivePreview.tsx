import { Link } from 'react-router-dom'
import {
  effectiveFieldVisibility,
  isPublicProfileKinkStatus,
  type ProfileFieldVisibilityKey,
  type ProfileFieldVisibilityMap,
} from '@c2k/shared'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import BadgeDisplay from '@/components/BadgeDisplay'
import MarkdownContent from '@/components/ui/MarkdownContent'
import type { BadgeId } from '@/data/types'
import { formatInterestLabel } from '@/lib/profile-display'

export type ProfileEditPreviewDraft = {
  displayName: string
  username: string
  bio: string
  locationLabel: string
  pronouns?: string
  genders: string[]
  sexualOrientations: string[]
  romanticOrientations: string[]
  roles: string[]
  lifestyleActivity: string
  lookingFor: string[]
  photoUrl: string | null
  kinks: { displayName: string; interestStatus: string }[]
  trustScore: number
  badges: BadgeId[]
  fieldVisibility: ProfileFieldVisibilityMap
}

function PreviewFieldRow({
  label,
  values,
  visibilityKey,
  fieldVisibility,
}: {
  label: string
  values: string[]
  visibilityKey?: ProfileFieldVisibilityKey
  fieldVisibility: ProfileFieldVisibilityMap
}) {
  if (values.length === 0) return null
  const hidden =
    visibilityKey != null && effectiveFieldVisibility(visibilityKey, fieldVisibility) === 'hidden'
  const friendsOnly =
    visibilityKey != null && effectiveFieldVisibility(visibilityKey, fieldVisibility) === 'friends'

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted mb-1">{label}</p>
      {hidden ?
        <p className="text-xs text-dc-muted italic">Hidden from public profile</p>
      : <>
          <div className="flex flex-wrap gap-1">
            {values.map((v) => (
              <span
                key={v}
                className="px-2 py-0.5 text-[10px] font-medium bg-dc-accent/15 text-dc-accent border border-dc-accent-border/30 rounded-full"
              >
                {v}
              </span>
            ))}
          </div>
          {friendsOnly ?
            <p className="mt-1 text-[10px] text-dc-muted">Connections only on live profile</p>
          : null}
        </>
      }
    </div>
  )
}

export default function ProfileEditLivePreview({
  draft,
  publicProfileHref,
  hasUnsavedChanges,
}: {
  draft: ProfileEditPreviewDraft
  publicProfileHref: string | null
  hasUnsavedChanges?: boolean
}) {
  const orientations = [...draft.sexualOrientations, ...draft.romanticOrientations]
  const statusLabel = hasUnsavedChanges ? 'Unsaved changes' : 'Saved'
  const publicKinks = draft.kinks.filter((k) => isPublicProfileKinkStatus(k.interestStatus))

  const locationLevel = effectiveFieldVisibility('location', draft.fieldVisibility)
  const pronounsLevel = effectiveFieldVisibility('pronouns', draft.fieldVisibility)
  const locationLine =
    locationLevel === 'hidden' ? 'Location hidden'
    : draft.locationLabel.trim() || 'No location set'
  const pronounsLine =
    pronounsLevel === 'hidden' ? null
    : draft.pronouns?.trim() || null
  const headerMeta = [locationLine, pronounsLine].filter(Boolean).join(' · ')

  return (
    <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 shadow-[var(--dc-shadow-soft)] overflow-hidden lg:sticky lg:top-24">
      <div className="px-4 py-3 border-b border-dc-border bg-dc-surface-muted/50 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-dc-text">How this appears on your profile</p>
          <p
            className={`text-xs mt-0.5 ${hasUnsavedChanges ? 'text-amber-300/90' : 'text-emerald-300/80'}`}
            role="status"
          >
            {hasUnsavedChanges ? 'Save to update what others see' : statusLabel}
          </p>
        </div>
        {publicProfileHref ?
          <Link
            to={publicProfileHref}
            className="shrink-0 text-xs font-medium text-dc-accent hover:underline"
          >
            Open full view
          </Link>
        : null}
      </div>

      <div className="relative h-20 bg-gradient-to-br from-dc-accent/20 via-dc-surface-muted to-dc-elevated-solid">
        {draft.photoUrl ?
          <img
            src={draft.photoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm scale-105"
            aria-hidden
          />
        : null}
      </div>

      <div className="px-4 pb-3 -mt-9 flex gap-3 items-end">
        <div className="h-14 w-14 shrink-0 rounded-full ring-4 ring-dc-elevated/95 overflow-hidden bg-dc-elevated-solid">
          {draft.photoUrl ?
            <img src={draft.photoUrl} alt="" className="h-full w-full object-cover" />
          : <PlaceholderAvatar size="md" className="!rounded-full h-full w-full" />}
        </div>
        <div className="flex-1 min-w-0 pb-0.5">
          <p className="font-bold text-dc-text truncate">{draft.displayName}</p>
          <p className="text-xs text-dc-muted">@{draft.username}</p>
          <p className="text-xs text-dc-text-muted mt-0.5 truncate">{headerMeta}</p>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <PreviewFieldRow
          label="Gender"
          values={draft.genders}
          visibilityKey="gender"
          fieldVisibility={draft.fieldVisibility}
        />
        <PreviewFieldRow
          label="Orientation"
          values={orientations}
          visibilityKey="sexuality"
          fieldVisibility={draft.fieldVisibility}
        />
        {draft.roles.length > 0 || draft.badges.length > 0 ?
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted mb-1">Roles</p>
            <div className="flex flex-wrap gap-1">
              {draft.roles.slice(0, 4).map((role) => (
                <span
                  key={role}
                  className="px-2 py-0.5 text-[10px] font-medium bg-dc-accent/15 text-dc-accent border border-dc-accent-border/30 rounded-full"
                >
                  {role}
                </span>
              ))}
              <BadgeDisplay badges={draft.badges} maxVisible={2} size="sm" />
            </div>
          </div>
        : null}
        {draft.lifestyleActivity ?
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted mb-1">Experience</p>
            <p className="text-xs text-dc-text-muted">{draft.lifestyleActivity}</p>
          </div>
        : null}
        {draft.lookingFor.length > 0 ?
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted mb-1">Connection goals</p>
            <div className="flex flex-wrap gap-1">
              {draft.lookingFor.slice(0, 4).map((goal) => (
                <span
                  key={goal}
                  className="px-2 py-0.5 text-[10px] font-medium bg-dc-accent/15 text-dc-accent border border-dc-accent-border/30 rounded-full"
                >
                  {goal}
                </span>
              ))}
            </div>
          </div>
        : null}

        <div className="rounded-xl border border-dc-border bg-dc-surface-muted/40 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted">About</p>
          {draft.bio.trim() ?
            <MarkdownContent markdown={draft.bio} className="text-sm line-clamp-4 [&_p]:my-1" />
          : <p className="text-sm text-dc-muted italic">No bio yet.</p>}

          {publicKinks.length > 0 ?
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted mb-1">Interests</p>
              <p className="text-[10px] text-dc-muted mb-1">Only Into and Curious appear on public profiles</p>
              <ul className="space-y-1">
                {publicKinks.slice(0, 4).map((k, i) => (
                  <li key={`${k.displayName}-${i}`} className="text-xs text-dc-text-muted">
                    <span className="font-medium text-dc-text">{k.displayName}</span>
                    <span className="text-dc-muted"> · {formatInterestLabel(k.interestStatus)}</span>
                  </li>
                ))}
              </ul>
            </div>
          : null}
        </div>
      </div>
    </div>
  )
}
