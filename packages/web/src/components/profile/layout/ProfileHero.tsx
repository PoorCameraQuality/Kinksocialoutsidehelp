import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { ProfilePhotoDisplaySettings } from '@c2k/shared'

import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import ProfilePhotoCredit from '@/components/profile/ProfilePhotoCredit'
import ProfilePill from '@/components/profile/story/ProfilePill'
import { IconMapPin } from '@/components/profile/story/ProfileStoryIcons'
import { cardSurfaceElevatedClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'

type Props = {
  displayName: string
  username: string
  ageLabel?: string
  pronouns?: string
  genders?: string[]
  sexualOrientations?: string[]
  romanticOrientations?: string[]
  location?: string
  roles?: string[]
  photoUrl?: string | null
  photoCaption?: string | null
  photoDisplaySettings?: ProfilePhotoDisplaySettings | null
  photoCount?: number
  onOpenGallery?: () => void
  /** Owner shortcut — opens Profile Studio instead of the public Media tab. */
  managePhotosHref?: string
  actions: ReactNode
  className?: string
}

function joinLabels(values: string[] | undefined): string | null {
  if (!values) return null
  const items = values.map((v) => v.trim()).filter(Boolean)
  return items.length > 0 ? items.join(' · ') : null
}

/**
 * Unified responsive profile hero — photo-forward top third, identity + actions below.
 */
export default function ProfileHero({
  displayName,
  username,
  ageLabel,
  pronouns,
  genders,
  sexualOrientations = [],
  romanticOrientations = [],
  location,
  roles = [],
  photoUrl,
  photoCaption,
  photoDisplaySettings,
  photoCount = 0,
  onOpenGallery,
  managePhotosHref,
  actions,
  className,
}: Props) {
  const genderLabel = joinLabels(genders)
  const orientationLabel = joinLabels([...sexualOrientations, ...romanticOrientations])
  const showLocation = Boolean(location && location.trim() && location !== 'Unknown')

  const primaryMeta = [ageLabel, genderLabel, pronouns].filter(Boolean).join(' · ')
  const hasSecondaryMeta = Boolean(orientationLabel) || showLocation

  const canManagePhotos = Boolean(managePhotosHref)
  const canOpenGallery = Boolean(onOpenGallery) && !canManagePhotos
  const photoLabel =
    canManagePhotos ?
      photoCount > 0 ?
        `Manage profile photos, ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
      : 'Add profile photos in Profile Studio'
    : photoCount > 0 ?
      `Open photo gallery, ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
    : 'Add profile photos'

  const photoMedia = (
    <div
      className={cn(
        'c2k-profile-hero relative h-full min-h-[7.5rem] w-full overflow-hidden',
        'bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid',
        'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-24px_32px_-12px_rgba(0,0,0,0.35)]',
      )}
    >
      {photoUrl ?
        <ProfilePhotoImage
          src={photoUrl}
          displaySettings={photoDisplaySettings}
          className="absolute inset-0 h-full w-full object-cover object-[center_22%] transition-transform duration-300 group-hover/profile-photo:scale-[1.02]"
        />
      : (
        <div className="absolute inset-0 flex items-center justify-center">
          <PlaceholderAvatar size="xl" className="!h-20 !w-20 !rounded-2xl sm:!h-24 sm:!w-24" />
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-dc-elevated-solid from-[12%] via-dc-elevated-solid/72 via-[42%] to-transparent to-[92%]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/20" aria-hidden />
    </div>
  )

  const photoBand =
    canManagePhotos ?
      <Link
        to={managePhotosHref!}
        aria-label={photoLabel}
        className="group/profile-photo block min-h-[7.5rem] flex-[1] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dc-accent"
      >
        {photoMedia}
      </Link>
    : canOpenGallery ?
      <button
        type="button"
        onClick={onOpenGallery}
        aria-label={photoLabel}
        className="group/profile-photo block min-h-[7.5rem] w-full flex-[1] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dc-accent"
      >
        {photoMedia}
      </button>
    : (
      <div className="min-h-[7.5rem] flex-[1]">{photoMedia}</div>
    )

  return (
    <header
      className={cn(
        'flex min-h-[18rem] flex-col overflow-hidden ring-1 ring-inset ring-white/[0.05]',
        cardSurfaceElevatedClass,
        className,
      )}
    >
      {photoBand}

      <div className="relative z-10 flex flex-[2] flex-col px-5 pb-6 pt-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="break-words font-display text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">
              {displayName}
            </h1>
            {displayName !== username ?
              <p className="mt-0.5 text-sm text-dc-muted">@{username}</p>
            : null}
            {primaryMeta ?
              <p className="mt-1.5 text-[15px] font-medium text-dc-text-muted">{primaryMeta}</p>
            : null}
            {hasSecondaryMeta ?
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dc-text-muted">
                {orientationLabel ? <span>{orientationLabel}</span> : null}
                {showLocation ?
                  <span className="inline-flex items-center gap-1.5">
                    <IconMapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    {location}
                  </span>
                : null}
              </div>
            : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>
        </div>

        {roles.length > 0 ?
          <div className="mt-4 flex flex-wrap gap-2">
            {roles.map((role) => (
              <ProfilePill key={role} className="px-3 py-1 text-xs">
                {role}
              </ProfilePill>
            ))}
          </div>
        : null}

        <ProfilePhotoCredit caption={photoCaption} className="mt-3" />
      </div>
    </header>
  )
}
