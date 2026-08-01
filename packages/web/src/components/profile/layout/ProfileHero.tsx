import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { ProfilePhotoDisplaySettings } from '@c2k/shared'

import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import ProfilePhotoCredit from '@/components/profile/ProfilePhotoCredit'
import ProfilePill from '@/components/profile/story/ProfilePill'
import { IconCamera, IconMapPin } from '@/components/profile/story/ProfileStoryIcons'
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
  intro?: string | null
  photoUrl?: string | null
  photoCaption?: string | null
  photoDisplaySettings?: ProfilePhotoDisplaySettings | null
  photoCount?: number
  onOpenGallery?: () => void
  /** Owner shortcut — opens Photos Studio. */
  managePhotosHref?: string
  /** Owner edit profile link (restrained). */
  editProfileHref?: string
  actions: ReactNode
  className?: string
}

function joinLabels(values: string[] | undefined): string | null {
  if (!values) return null
  const items = values.map((v) => v.trim()).filter(Boolean)
  return items.length > 0 ? items.join(' · ') : null
}

/**
 * Compact photo-forward identity header: portrait beside name/meta/actions.
 * Optional blurred primary photo as darkened atmosphere — not a cover-photo system.
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
  intro,
  photoUrl,
  photoCaption,
  photoDisplaySettings,
  photoCount = 0,
  onOpenGallery,
  managePhotosHref,
  editProfileHref,
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
      : 'Add profile photos in Photos Studio'
    : photoCount > 0 ?
      `Open photo gallery, ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
    : 'Add profile photos'

  const portrait = (
    <div
      className={cn(
        'relative h-[8.75rem] w-[7rem] shrink-0 overflow-hidden rounded-xl sm:h-[15rem] sm:w-[11.875rem]',
        'bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid',
        'ring-1 ring-inset ring-white/[0.08]',
      )}
    >
      {photoUrl ?
        <ProfilePhotoImage
          src={photoUrl}
          displaySettings={photoDisplaySettings}
          className="h-full w-full object-cover transition-transform duration-300 group-hover/profile-photo:scale-[1.02]"
        />
      : (
        <div className="flex h-full w-full items-center justify-center">
          <PlaceholderAvatar size="lg" className="!h-16 !w-16 !rounded-xl sm:!h-20 sm:!w-20" />
        </div>
      )}
      {canManagePhotos ?
        <span className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-dc-elevated-solid/90 text-dc-text ring-1 ring-white/15">
          <IconCamera className="h-4 w-4" aria-hidden />
          <span className="sr-only">Edit profile picture</span>
        </span>
      : null}
    </div>
  )

  const portraitControl =
    canManagePhotos ?
      <Link
        to={managePhotosHref!}
        aria-label={photoLabel}
        className="group/profile-photo shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
      >
        {portrait}
      </Link>
    : canOpenGallery ?
      <button
        type="button"
        onClick={onOpenGallery}
        aria-label={photoLabel}
        className="group/profile-photo shrink-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
      >
        {portrait}
      </button>
    : (
      <div className="shrink-0">{portrait}</div>
    )

  return (
    <header
      className={cn(
        'relative overflow-hidden ring-1 ring-inset ring-white/[0.05]',
        cardSurfaceElevatedClass,
        className,
      )}
    >
      {photoUrl ?
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <img
            src={photoUrl}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-40 blur-2xl"
          />
          <div className="absolute inset-0 bg-dc-surface/85" />
        </div>
      : null}

      <div className="relative z-10 flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-6 sm:p-6 lg:p-7">
        {portraitControl}

        <div className="min-w-0 flex-1">
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

              {roles.length > 0 ?
                <div className="mt-3 flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <ProfilePill key={role} className="px-3 py-1 text-xs">
                      {role}
                    </ProfilePill>
                  ))}
                </div>
              : null}

              {intro?.trim() ?
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-dc-text-muted">{intro.trim()}</p>
              : null}

              <ProfilePhotoCredit caption={photoCaption} className="mt-2" />
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>
              {canManagePhotos || editProfileHref ?
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {editProfileHref ?
                    <Link
                      to={editProfileHref}
                      className="inline-flex min-h-9 items-center rounded-lg border border-dc-border-subtle px-3 text-sm text-dc-text hover:border-dc-accent"
                    >
                      Edit profile
                    </Link>
                  : null}
                  {managePhotosHref ?
                    <Link
                      to={managePhotosHref}
                      className="inline-flex min-h-9 items-center rounded-lg border border-dc-border-subtle px-3 text-sm text-dc-text-muted hover:border-dc-accent hover:text-dc-text"
                    >
                      Manage photos
                    </Link>
                  : null}
                </div>
              : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
