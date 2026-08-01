import type { ReactNode } from 'react'
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
import type { ProfileEditTabId } from '@/components/profile/edit/ProfileEditTabNav'
import type { PresenceSectionId } from '@/components/profile/edit/PresencePanel'

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
  kinksCount: number
  kinkLabels: string[]
  linksCount: number
  photoUrl: string | null
  photoCaption?: string | null
  photoDisplaySettings?: ProfilePhotoDisplaySettings | null
  fieldVisibility: ProfileFieldVisibilityMap
}

type Props = {
  section: ProfileEditTabId
  presenceSubsection?: PresenceSectionId
  draft: ProfileStudioPreviewDraft
  hasUnsavedChanges?: boolean
  photoUploadStage?: MediaUploadStage | null
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

function PreviewShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ProfileCard title={title} className={profileStudioSectionCardClass}>
      <div className={`${profileStudioInsetCardClass} space-y-3 p-3`}>{children}</div>
    </ProfileCard>
  )
}

/** Contextual preview for the active Profile Studio section. */
export default function ProfileStudioLivePreview({
  section,
  presenceSubsection = 'connections',
  draft,
  hasUnsavedChanges,
  photoUploadStage = null,
}: Props) {
  const tagline = deriveProfileTagline(draft.bio)

  const draftNote =
    hasUnsavedChanges ?
      <p className="mb-3 text-xs text-amber-200/90" role="status">
        Unsaved edits — preview updates as you type; visitors see saved values.
      </p>
    : null

  if (section === 'photos') {
    return (
      <PreviewShell title="What visitors will see">
        {draftNote}
        <div className="relative mx-auto h-48 w-36 overflow-hidden rounded-xl border border-white/[0.07] bg-dc-surface-muted">
          {draft.photoUrl ?
            <ProfilePhotoImage
              src={draft.photoUrl}
              displaySettings={draft.photoDisplaySettings}
              className="h-full w-full"
            />
          : (
            <div className="flex h-full flex-col items-center justify-center p-2">
              <PlaceholderAvatar size="md" className="!rounded-xl" />
              <p className="mt-2 text-center text-[10px] text-dc-muted">No profile picture yet</p>
            </div>
          )}
          {photoUploadStage ?
            <MediaUploadProgressOverlay stage={photoUploadStage} compact />
          : null}
        </div>
        <ProfilePhotoCredit caption={draft.photoCaption} className="mt-2" />
        <p className="text-[11px] leading-relaxed text-dc-text-muted">
          Gallery photos appear below your hero on your public profile. Pending photos stay hidden until approved.
        </p>
      </PreviewShell>
    )
  }

  if (section === 'identity') {
    const identityChips = [
      ...(draft.pronouns ? [draft.pronouns] : []),
      ...draft.genders,
      ...draft.sexualOrientations,
      ...draft.romanticOrientations,
      ...draft.roles,
      ...(draft.lifestyleActivity.trim() ? [draft.lifestyleActivity.trim()] : []),
    ]

    return (
      <PreviewShell title="What visitors will see">
        {draftNote}
        {identityChips.length > 0 ?
          <div className="flex flex-wrap gap-1.5">
            {identityChips.slice(0, 8).map((chip) => (
              <ProfilePill key={chip} className="px-2 py-0.5 text-[10px]">
                {chip}
              </ProfilePill>
            ))}
          </div>
        : <p className="text-[11px] italic text-dc-muted">Identity fields will appear here once added.</p>}
      </PreviewShell>
    )
  }

  if (section === 'interests') {
    return (
      <PreviewShell title="What visitors will see">
        {draftNote}
        {draft.kinksCount > 0 ?
          <>
            <p className="text-[11px] text-dc-text-muted">
              {draft.kinksCount} interest{draft.kinksCount === 1 ? '' : 's'} selected
            </p>
            {draft.kinkLabels.length > 0 ?
              <div className="flex flex-wrap gap-1.5">
                {draft.kinkLabels.slice(0, 6).map((label) => (
                  <ProfilePill key={label} className="px-2 py-0.5 text-[10px]">
                    {label}
                  </ProfilePill>
                ))}
              </div>
            : null}
          </>
        : <p className="text-[11px] italic text-dc-muted">Selected interests appear in your Interests section.</p>}
      </PreviewShell>
    )
  }

  if (section === 'presence') {
    if (presenceSubsection === 'links') {
      return (
        <PreviewShell title="What visitors will see">
          {draftNote}
          <p className="text-[11px] text-dc-text-muted">
            {draft.linksCount > 0 ?
              `${draft.linksCount} public link${draft.linksCount === 1 ? '' : 's'} on your profile.`
            : 'Links appear below your About section when added.'}
          </p>
        </PreviewShell>
      )
    }

    if (presenceSubsection === 'visibility') {
      return (
        <PreviewShell title="What visitors will see">
          {draftNote}
          <p className="text-[11px] leading-relaxed text-dc-text-muted">
            Profile visibility controls what logged-in visitors see for About, Identity, Interests, Looking For,
            Relationships, Location, and Photos. Account-wide discovery settings are separate.
          </p>
        </PreviewShell>
      )
    }

    if (presenceSubsection === 'relationships') {
      return (
        <PreviewShell title="What visitors will see">
          {draftNote}
          <p className="text-[11px] text-dc-text-muted">
            Relationship summaries appear when visibility allows. Each record can show a label and linked member.
          </p>
        </PreviewShell>
      )
    }

    return (
      <PreviewShell title="What visitors will see">
        {draftNote}
        {draft.lookingFor.length > 0 ?
          <div className="flex flex-wrap gap-1.5">
            {draft.lookingFor.slice(0, 6).map((goal) => (
              <ProfilePill key={goal} className="px-2 py-0.5 text-[10px]">
                {goal}
              </ProfilePill>
            ))}
          </div>
        : <p className="text-[11px] italic text-dc-muted">Connection goals appear on your public profile.</p>}
      </PreviewShell>
    )
  }

  // overview (default)
  const identityFacts: { label: string; value: string }[] = []
  const age = previewFieldValue('age', draft.ageLabel, draft.fieldVisibility)
  if (age) identityFacts.push({ label: 'Age', value: age })
  const location = previewFieldValue('location', draft.locationLabel, draft.fieldVisibility)
  if (location) identityFacts.push({ label: 'Location', value: location })
  const pronouns = previewFieldValue('pronouns', draft.pronouns, draft.fieldVisibility)
  if (pronouns) identityFacts.push({ label: 'Pronouns', value: pronouns })

  return (
    <PreviewShell title="What visitors will see">
      {draftNote}
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-dc-elevated/40 p-3 c2k-profile-hero">
        <div className="flex items-start gap-3">
          <div className="relative h-[100px] w-20 shrink-0 overflow-hidden rounded-xl bg-dc-surface-muted ring-2 ring-dc-surface">
            {draft.photoUrl ?
              <ProfilePhotoImage
                src={draft.photoUrl}
                displaySettings={draft.photoDisplaySettings}
                className="h-full w-full"
              />
            : (
              <div className="flex h-full items-center justify-center">
                <PlaceholderAvatar size="md" className="!rounded-xl" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words font-display text-base font-bold leading-tight text-dc-text">
              {draft.displayName}
            </p>
            {tagline ?
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-dc-text-muted italic">
                &ldquo;{tagline}&rdquo;
              </p>
            : null}
            {identityFacts.length > 0 ?
              <dl className="mt-2 grid grid-cols-[minmax(4rem,auto)_1fr] gap-x-2 gap-y-1">
                {identityFacts.map((fact) => (
                  <IdentityFact key={fact.label} label={fact.label} value={fact.value} />
                ))}
              </dl>
            : null}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-dc-elevated/30 px-3 py-2.5">
        <p className={profileStoryEyebrow}>About</p>
        {draft.bio.trim() ?
          <MarkdownContent
            markdown={draft.bio}
            className="mt-1.5 line-clamp-4 text-[11px] leading-relaxed text-dc-text-muted [&_p]:my-0.5"
          />
        : <p className="mt-1.5 text-[11px] italic text-dc-muted">Your about section will appear here.</p>}
      </div>
    </PreviewShell>
  )
}
