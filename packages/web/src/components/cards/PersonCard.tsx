import { Link } from 'react-router-dom'
import {
  personAvatarGradientClass,
  personDisplayLabel,
  personInitials,
} from '@/components/PersonAvatar'
import CommunityTrustChip from '@/components/trust/CommunityTrustChip'
import Card from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { activityIndicatorFromISO } from '@/lib/profile-activity'

/** Mini profile preview - no gender, pronouns, or orientation (those live on the full profile only). */
export type PersonCardProps = {
  person: {
    id?: number | string
    username: string
    /** Scene / display name shown as the primary heading. */
    sceneName?: string | null
    age?: number | null
    location?: string | null
    verified?: boolean
    mutualCount?: number
    /** e.g. co-attendance suggestion */
    sharedEventsCount?: number
    distance?: string
    avatarUrl?: string
    lastActiveAt?: string | null
  }
}

export default function PersonCard({ person }: PersonCardProps) {
  const {
    username,
    sceneName,
    age,
    location,
    verified,
    mutualCount = 0,
    sharedEventsCount = 0,
    distance,
    avatarUrl,
    lastActiveAt,
  } = person

  const trimmedScene = sceneName?.trim()
  const hasSceneName = Boolean(trimmedScene)
  const displayName = hasSceneName ? trimmedScene! : username
  const photoLabel = personDisplayLabel(username, sceneName)
  const activityResult = activityIndicatorFromISO(lastActiveAt ?? undefined)
  const activityLabel = activityResult.hidden ? null : activityResult.label
  const ageLocation =
    [age != null ? `${age}` : null, location?.trim() || null].filter(Boolean).join(' · ') || null
  const hasAvatar = Boolean(avatarUrl?.trim())

  return (
    <Card interactive className="min-w-0 overflow-hidden p-0">
      <Link
        to={`/profile/${username}`}
        className="group/person-card flex min-h-[6.75rem] min-w-0"
        aria-label={`View ${displayName}'s profile`}
      >
        <div className="relative w-[7.5rem] shrink-0 self-stretch sm:w-[8.25rem]" aria-hidden>
          <div
            className={cn(
              'absolute inset-y-2 left-2 right-0 overflow-hidden rounded-xl',
              'bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid',
              'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),inset_0_0_22px_rgba(0,0,0,0.18)]',
            )}
          >
            {hasAvatar ?
              <img
                src={avatarUrl}
                alt=""
                width={132}
                height={132}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover object-center transition-transform duration-300 group-hover/person-card:scale-[1.03]"
              />
            : <div
                className={cn(
                  'flex h-full w-full items-center justify-center bg-gradient-to-br',
                  personAvatarGradientClass(username),
                )}
              >
                <span className="text-xl font-bold text-white/95">{personInitials(photoLabel)}</span>
              </div>
            }
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent from-[12%] via-dc-elevated-solid/70 via-[62%] to-dc-elevated-solid to-[96%]"
            />
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/15" />
          </div>
          {verified ?
            <span className="absolute bottom-3 left-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-dc-accent ring-2 ring-dc-elevated-solid">
              <svg className="h-3 w-3 text-dc-text" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          : null}
        </div>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-4 pl-2">
          <h3 className="min-w-0 text-base font-semibold leading-snug text-dc-text line-clamp-2 break-words">
            {displayName}
          </h3>
          {hasSceneName ? <p className="text-xs text-dc-muted">@{username}</p> : null}
          <CommunityTrustChip username={username} />
          {activityLabel ? (
            <span className="inline-flex w-fit items-center rounded-md border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-[11px] font-medium text-dc-muted">
              {activityLabel}
            </span>
          ) : null}
          {ageLocation ? <p className="text-sm text-dc-text-muted">{ageLocation}</p> : null}
          {mutualCount > 0 || sharedEventsCount > 0 || distance ? (
            <p className="mt-0.5 text-xs text-dc-muted">
              {sharedEventsCount > 0 ? `${sharedEventsCount} shared events` : null}
              {sharedEventsCount > 0 && mutualCount > 0 ? ' · ' : null}
              {mutualCount > 0 ? `${mutualCount} mutual` : null}
              {(mutualCount > 0 || sharedEventsCount > 0) && distance ? ' · ' : null}
              {distance ? distance : null}
            </p>
          ) : null}
        </div>
      </Link>
    </Card>
  )
}
