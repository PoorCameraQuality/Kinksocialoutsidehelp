import { Link } from 'react-router-dom'
import {
  effectiveFieldVisibility,
  type ProfileFieldVisibilityKey,
  type ProfileFieldVisibilityMap,
  type ProfilePhotoDisplaySettings,
} from '@c2k/shared'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import ProfilePhotoCredit from '@/components/profile/ProfilePhotoCredit'
import ProfilePill from '@/components/profile/story/ProfilePill'
import ProfileCard from '@/components/profile/story/ProfileCard'
import { profileStoryEyebrow } from '@/components/profile/story/profile-story-classes'
import { profileStudioInsetCardClass, profileStudioSectionCardClass } from './profile-studio-classes'
import { deriveProfileTagline } from '@/lib/profile-story/derive'
import MarkdownContent from '@/components/ui/MarkdownContent'
import {
  MediaUploadProgressOverlay,
  type MediaUploadStage,
} from '@/components/media/MediaUploadProgress'

export type ProfileStudioPreviewDraft = {
  displayName: string
  username: string
  bio: string
  locationLabel: string
  ageLabel?: string
  pronouns?: string
  genders: string[]
  sexualOrientations: string[]
  romanticOrientations: string[]
  roles: string[]
  lifestyleActivity: string
  lookingFor: string[]
  photoUrl: string | null
  photoCaption?: string | null
  photoDisplaySettings?: ProfilePhotoDisplaySettings | null
  fieldVisibility: ProfileFieldVisibilityMap
}

type Props = {
  draft: ProfileStudioPreviewDraft
  publicProfileHref: string | null
  hasUnsavedChanges?: boolean
  photoUploadStage?: MediaUploadStage | null
}

function joinLabels(values: string[]): string | null {
  const items = values.map((v) => v.trim()).filter(Boolean)
  return items.length > 0 ? items.join(' · ') : null
}

function previewFieldValue(
  key: ProfileFieldVisibilityKey,
  value: string | null | undefined,
  map: ProfileFieldVisibilityMap,
): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const level = effectiveFieldVisibility(key, map)
  if (level === 'hidden') return null
  return level === 'friends' ? `${trimmed} (connections only)` : trimmed
}

function IdentityFact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[10px] font-medium text-dc-muted">{label}</dt>
      <dd className="text-[11px] leading-snug text-dc-text">{value}</dd>
    </>
  )
}

/** Miniature of the public profile hero + About card. */
export default function ProfileStudioLivePreview({
  draft,
  publicProfileHref,
  hasUnsavedChanges,
  photoUploadStage = null,
}: Props) {
  const tagline = deriveProfileTagline(draft.bio)
  const genderLabel = joinLabels(draft.genders)
  const orientationLabel = joinLabels([...draft.sexualOrientations, ...draft.romanticOrientations])

  const identityFacts: { label: string; value: string }[] = []
  const age = previewFieldValue('age', draft.ageLabel, draft.fieldVisibility)
  if (age) identityFacts.push({ label: 'Age', value: age })
  const gender = previewFieldValue('gender', genderLabel, draft.fieldVisibility)
  if (gender) identityFacts.push({ label: 'Gender', value: gender })
  const orientation = previewFieldValue('sexuality', orientationLabel, draft.fieldVisibility)
  if (orientation) identityFacts.push({ label: 'Orientation', value: orientation })
  const location = previewFieldValue('location', draft.locationLabel, draft.fieldVisibility)
  if (location) identityFacts.push({ label: 'Location', value: location })
  const pronouns = previewFieldValue('pronouns', draft.pronouns, draft.fieldVisibility)
  if (pronouns) identityFacts.push({ label: 'Pronouns', value: pronouns })

  return (
    <ProfileCard
      title="Live public preview"
      className={profileStudioSectionCardClass}
      action={
        publicProfileHref ?
          <Link to={publicProfileHref} className="text-xs font-medium text-dc-accent hover:underline">
            Open full preview
          </Link>
        : null
      }
    >
      <p
        className={`mb-4 text-xs ${hasUnsavedChanges ? 'text-amber-200/90' : 'text-emerald-300/80'}`}
        role="status"
      >
        {hasUnsavedChanges ? 'Save to update what others see' : 'Reflects your current draft'}
      </p>

      <div className={`${profileStudioInsetCardClass} space-y-3 p-3`}>
        <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-dc-elevated/40 p-3 c2k-profile-hero">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <div className="relative h-[130px] w-[104px] overflow-hidden rounded-xl bg-dc-surface-muted shadow-[0_8px_24px_-14px_rgba(0,0,0,0.55)] ring-2 ring-dc-surface ring-offset-1 ring-offset-dc-bg">
                {draft.photoUrl ?
                  <ProfilePhotoImage
                    src={draft.photoUrl}
                    displaySettings={draft.photoDisplaySettings}
                    className="h-full w-full"
                  />
                : (
                  <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-dc-accent/15 via-dc-surface-muted to-dc-elevated-solid p-2 text-center">
                    <PlaceholderAvatar size="md" className="!rounded-xl" />
                  </div>
                )}
                {photoUploadStage ?
                  <MediaUploadProgressOverlay stage={photoUploadStage} compact />
                : null}
              </div>
              <ProfilePhotoCredit caption={draft.photoCaption} className="mt-1.5 max-w-[104px]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="break-words font-display text-lg font-bold leading-tight tracking-tight text-dc-text">
                {draft.displayName}
              </p>
              {draft.displayName !== draft.username ?
                <p className="mt-0.5 text-[11px] text-dc-muted">@{draft.username}</p>
              : null}
              {tagline ?
                <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-dc-text-muted italic">
                  &ldquo;{tagline}&rdquo;
                </p>
              : null}

              {identityFacts.length > 0 ?
                <dl className="mt-2.5 grid grid-cols-[minmax(4.25rem,auto)_1fr] gap-x-2 gap-y-1.5 rounded-lg bg-dc-surface-muted/30 px-2 py-2 ring-1 ring-inset ring-white/[0.05]">
                  {identityFacts.map((fact) => (
                    <IdentityFact key={fact.label} label={fact.label} value={fact.value} />
                  ))}
                </dl>
              : null}

              {draft.roles.length > 0 ?
                <div className="mt-2.5">
                  <p className={profileStoryEyebrow}>Roles</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {draft.roles.slice(0, 3).map((role) => (
                      <ProfilePill key={role} className="px-2 py-0.5 text-[10px]">
                        {role}
                      </ProfilePill>
                    ))}
                  </div>
                </div>
              : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-dc-elevated/30 px-3 py-2.5">
          <p className={profileStoryEyebrow}>About {draft.displayName}</p>
          {draft.bio.trim() ?
            <MarkdownContent
              markdown={draft.bio}
              className="mt-1.5 line-clamp-4 text-[11px] leading-relaxed text-dc-text-muted [&_p]:my-0.5"
            />
          : <p className="mt-1.5 text-[11px] italic text-dc-muted">Your about section will appear here.</p>}
        </div>
      </div>
    </ProfileCard>
  )
}
