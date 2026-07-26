import type { ReactNode } from 'react'
import type { ProfilePhotoDisplaySettings } from '@c2k/shared'
import { PROFILE_HERO_PHOTO_FRAME_CLASS } from '@c2k/shared'

import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import ProfilePhotoCredit from '@/components/profile/ProfilePhotoCredit'

import ProfileCard from './ProfileCard'
import ProfilePill from './ProfilePill'

import { profileStoryEyebrow } from './profile-story-classes'
import { IconCamera, IconMapPin } from './ProfileStoryIcons'

type Props = {
  displayName: string
  username: string
  tagline: string
  location: string
  ageLabel?: string
  pronouns?: string
  genders?: string[]
  sexualOrientations?: string[]
  romanticOrientations?: string[]
  roles?: string[]
  photoUrl?: string
  photoCaption?: string | null
  photoDisplaySettings?: ProfilePhotoDisplaySettings | null
  photoCount?: number
  onOpenGallery?: () => void
  actions: ReactNode
}

function galleryCountLabel(count: number): string {
  if (count === 0) return 'Add photos'
  return count === 1 ? '1 photo' : `${count} photos`
}

function joinLabels(values: string[]): string | null {
  const items = values.map((v) => v.trim()).filter(Boolean)
  return items.length > 0 ? items.join(' · ') : null
}

function IdentityFact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs font-medium text-dc-muted">{label}</dt>
      <dd className="text-sm text-dc-text">{value}</dd>
    </>
  )
}

export default function ProfileHeroCard({
  displayName,
  username,
  tagline,
  location,
  ageLabel,
  pronouns,
  genders = [],
  sexualOrientations = [],
  romanticOrientations = [],
  roles = [],
  photoUrl,
  photoCaption,
  photoDisplaySettings,
  photoCount = 0,
  onOpenGallery,
  actions,
}: Props) {
  const showLocation = Boolean(location && location !== 'Unknown')
  const orientationLabel = joinLabels([...sexualOrientations, ...romanticOrientations])
  const genderLabel = joinLabels(genders)
  const showGalleryAffordance = Boolean(onOpenGallery)
  const galleryLabel = showGalleryAffordance ? galleryCountLabel(photoCount) : null

  const identityFacts: { label: string; value: string }[] = []
  if (ageLabel) identityFacts.push({ label: 'Age', value: ageLabel })
  if (genderLabel) identityFacts.push({ label: 'Gender', value: genderLabel })
  if (orientationLabel) identityFacts.push({ label: 'Orientation', value: orientationLabel })
  if (showLocation) identityFacts.push({ label: 'Location', value: location })
  if (pronouns) identityFacts.push({ label: 'Pronouns', value: pronouns })

  const photoFrameClass = `${PROFILE_HERO_PHOTO_FRAME_CLASS} c2k-avatar-ring shadow-[0_16px_40px_-20px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/[0.1]`

  const photoContent =
    photoUrl ?
      <ProfilePhotoImage src={photoUrl} displaySettings={photoDisplaySettings} className="h-full w-full" />
    : <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-dc-accent/15 via-dc-surface-muted to-dc-elevated-solid p-4 text-center">
        <PlaceholderAvatar size="lg" className="!rounded-2xl" />
        <p className="text-xs text-dc-muted/90">Privacy-safe placeholder</p>
      </div>

  const galleryBadge =
    galleryLabel ?
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-2.5 pb-2.5 pt-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-dc-accent">
          <IconCamera className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {galleryLabel}
        </span>
      </span>
    : null

  return (
    <ProfileCard variant="hero" className="p-0">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-6 lg:p-7">
        <div className="mx-auto shrink-0 sm:mx-0">
          {showGalleryAffordance ?
            <button
              type="button"
              onClick={onOpenGallery}
              className="group block w-[160px] text-left sm:w-[176px]"
              aria-label={
                photoCount > 0 ?
                  `Open photo gallery, ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
                : 'Add profile photos'
              }
            >
              <div
                className={`${photoFrameClass} transition-transform group-hover:scale-[1.01] group-active:scale-[0.99] group-hover:ring-dc-accent/25`}
              >
                {photoContent}
                {galleryBadge}
              </div>
            </button>
          : <div className={photoFrameClass}>{photoContent}</div>}
          <ProfilePhotoCredit caption={photoCaption} className="mt-2 text-center sm:text-left max-w-[176px]" />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="font-display text-2xl font-bold tracking-tight text-dc-text sm:text-3xl break-words">{displayName}</h1>
          {displayName !== username ?
            <p className="mt-1 text-sm text-dc-muted">@{username}</p>
          : null}

          {tagline ?
            <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-dc-text-muted italic sm:mx-0">
              &ldquo;{tagline}&rdquo;
            </p>
          : null}

          {identityFacts.length > 0 ?
            <dl className="mx-auto mt-4 grid max-w-md grid-cols-[minmax(5.5rem,auto)_1fr] gap-x-4 gap-y-2.5 rounded-xl border border-dc-border-subtle/55 bg-dc-surface-muted/70 px-4 py-3.5 sm:mx-0">
              {identityFacts.map((fact) => (
                <IdentityFact key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </dl>
          : showLocation ?
            <p className="mt-3 inline-flex items-center justify-center gap-1.5 text-sm text-dc-text-muted sm:justify-start">
              <IconMapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              {location}
            </p>
          : null}

          {roles.length > 0 ?
            <div className="mt-4">
              <p className={profileStoryEyebrow}>Roles</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                {roles.map((role) => (
                  <ProfilePill key={role} className="text-xs px-3 py-1">
                    {role}
                  </ProfilePill>
                ))}
              </div>
            </div>
          : null}

          <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">{actions}</div>
        </div>
      </div>
    </ProfileCard>
  )
}
