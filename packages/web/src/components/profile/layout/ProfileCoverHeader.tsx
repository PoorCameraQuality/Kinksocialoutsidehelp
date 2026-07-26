import type { ReactNode } from 'react'

import type { ProfilePhotoDisplaySettings } from '@c2k/shared'

import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import ProfilePhotoCredit from '@/components/profile/ProfilePhotoCredit'
import ProfilePill from '@/components/profile/story/ProfilePill'
import { profileStoryEyebrow } from '@/components/profile/story/profile-story-classes'
import { IconCamera } from '@/components/profile/story/ProfileStoryIcons'
import { cn } from '@/lib/cn'

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
  photoUrl?: string | null
  photoCaption?: string | null
  photoDisplaySettings?: ProfilePhotoDisplaySettings | null
  photoCount?: number
  onOpenGallery?: () => void
  actions: ReactNode
  className?: string
}

function joinLabels(values: string[]): string | null {
  const items = values.map((v) => v.trim()).filter(Boolean)
  return items.length > 0 ? items.join(' · ') : null
}

function galleryCountLabel(count: number): string {
  if (count === 0) return 'Add photos'
  return count === 1 ? '1 photo' : `${count} photos`
}

function IdentityFact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs font-medium text-dc-muted">{label}</dt>
      <dd className="text-sm text-dc-text">{value}</dd>
    </>
  )
}

/** Desktop hero — large portrait photo with identity facts beside it. */
export default function ProfileCoverHeader({
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
  className,
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

  const photoFrameClass = cn(
    'relative overflow-hidden rounded-2xl bg-dc-surface-muted',
    'h-[240px] w-[192px] sm:h-[280px] sm:w-[224px] xl:h-[320px] xl:w-[256px]',
    'shadow-[0_16px_40px_-20px_rgba(0,0,0,0.55)] ring-2 ring-dc-surface ring-offset-2 ring-offset-dc-bg',
  )

  const photoContent =
    photoUrl ?
      <ProfilePhotoImage src={photoUrl} displaySettings={photoDisplaySettings} className="h-full w-full" />
    : <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-dc-accent/15 via-dc-surface-muted to-dc-elevated-solid p-4 text-center">
        <PlaceholderAvatar size="lg" className="!rounded-2xl" />
        <p className="text-xs text-dc-muted/90">Add a profile photo</p>
      </div>

  const galleryBadge =
    galleryLabel ?
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-3 pt-10">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
          <IconCamera className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {galleryLabel}
        </span>
      </span>
    : null

  const photoFrame = (
    <div className={photoFrameClass}>
      {photoContent}
      {galleryBadge}
    </div>
  )

  return (
    <header
      className={cn(
        'relative mb-6 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--dc-border-strong)_70%,var(--dc-border-subtle))] bg-dc-elevated-solid p-6 shadow-[var(--dc-shadow-panel)] ring-1 ring-inset ring-white/[0.05] c2k-profile-hero sm:p-7 xl:p-8',
        className,
      )}
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
        <div className="shrink-0">
          {showGalleryAffordance ?
            <button
              type="button"
              onClick={onOpenGallery}
              className="group block text-left"
              aria-label={
                photoCount > 0 ?
                  `Open photo gallery, ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
                : 'Add profile photos'
              }
            >
              <div className="transition-transform group-hover:scale-[1.01] group-active:scale-[0.99]">{photoFrame}</div>
            </button>
          : photoFrame}
          <ProfilePhotoCredit caption={photoCaption} className="mt-2.5 max-w-[192px] sm:max-w-[224px] xl:max-w-[256px]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h1 className="break-words font-display text-3xl font-bold tracking-tight text-dc-text xl:text-4xl">
                {displayName}
              </h1>
              {displayName !== username ?
                <p className="mt-1 text-sm text-dc-muted">@{username}</p>
              : null}
              {tagline ?
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-dc-text-muted italic line-clamp-3">
                  &ldquo;{tagline}&rdquo;
                </p>
              : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
          </div>

          {identityFacts.length > 0 ?
            <dl className="mt-5 grid max-w-lg grid-cols-[minmax(5.5rem,auto)_1fr] gap-x-5 gap-y-2.5 rounded-xl bg-dc-surface-muted/30 px-4 py-3.5 ring-1 ring-inset ring-white/[0.05]">
              {identityFacts.map((fact) => (
                <IdentityFact key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </dl>
          : null}

          {roles.length > 0 ?
            <div className="mt-5">
              <p className={profileStoryEyebrow}>Roles</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <ProfilePill key={role} className="px-2.5 py-0.5 text-xs">
                    {role}
                  </ProfilePill>
                ))}
              </div>
            </div>
          : null}
        </div>
      </div>
    </header>
  )
}
