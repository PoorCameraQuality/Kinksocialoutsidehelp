import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import BadgeDisplay from '@/components/BadgeDisplay'
import type { BadgeId } from '@/data/types'
import type { ReactNode } from 'react'

type Props = {
  displayName: string
  username: string
  location: string
  ageLabel?: string
  pronouns?: string
  genders?: string[]
  sexualOrientations?: string[]
  romanticOrientations?: string[]
  /** @deprecated use sexualOrientations */
  sexuality?: string
  lifestyleActivity?: string
  memberSince?: string
  roles: string[]
  primaryRole?: string
  badges: BadgeId[]
  trustChips?: string[]
  photoUrl?: string
  actions: ReactNode
}

function IdentityTag({ children }: { children: ReactNode }) {
  return (
    <span className="underline decoration-dotted decoration-dc-muted underline-offset-2">{children}</span>
  )
}

export default function ProfilePublicHero({
  displayName,
  username,
  location,
  ageLabel,
  pronouns,
  genders = [],
  sexualOrientations = [],
  romanticOrientations = [],
  sexuality,
  lifestyleActivity,
  memberSince,
  roles,
  primaryRole,
  badges,
  trustChips = [],
  photoUrl,
  actions,
}: Props) {
  const orientations =
    sexualOrientations.length > 0 || romanticOrientations.length > 0 ?
      [...sexualOrientations, ...romanticOrientations]
    : sexuality ? [sexuality] : []

  const headlineRole = primaryRole ?? roles[0]

  return (
    <header className="relative mb-5 overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated/95 shadow-[var(--dc-shadow-soft)]">
      <div className="relative h-24 sm:h-28">
        <div className="absolute inset-0 bg-gradient-to-br from-dc-accent/25 via-dc-surface-muted to-dc-elevated-solid" />
        {photoUrl ?
          <img
            src={photoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20 blur-md scale-105"
            aria-hidden
          />
        : null}
        <div className="absolute inset-0 bg-gradient-to-t from-dc-elevated/95 via-dc-elevated/40 to-transparent" />
      </div>

      <div className="relative px-4 sm:px-6 pb-5 -mt-14 sm:-mt-16">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="relative shrink-0 mx-auto sm:mx-0">
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full ring-4 ring-dc-elevated/95 shadow-lg overflow-hidden bg-dc-elevated-solid">
              {photoUrl ?
                <img src={photoUrl} alt="" className="h-full w-full rounded-full object-cover" />
              : <PlaceholderAvatar size="lg" className="!rounded-full" />}
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight text-dc-text break-words">{displayName}</h1>
            {displayName !== username ?
              <p className="text-sm text-dc-muted mt-0.5">@{username}</p>
            : null}

            {trustChips.length > 0 ?
              <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
                {trustChips.map((chip) => (
                  <span
                    key={chip}
                    className="px-2 py-0.5 text-[11px] font-medium rounded-full border border-dc-border bg-dc-surface-muted/80 text-dc-text-muted"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            : null}

            {(ageLabel || headlineRole || pronouns) ?
              <p className="mt-2 text-sm text-dc-text-muted">
                {[ageLabel, headlineRole, pronouns].filter(Boolean).join(' · ')}
              </p>
            : null}

            <ul className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-sm text-dc-text-muted">
              {location && location !== 'Unknown' ?
                <li>{location}</li>
              : null}
              {genders.map((g) => (
                <li
                  key={g}
                  className="before:content-['·'] before:mr-3 before:text-dc-muted first:before:content-none first:before:mr-0"
                >
                  <IdentityTag>{g}</IdentityTag>
                </li>
              ))}
              {orientations.map((o) => (
                <li
                  key={o}
                  className="before:content-['·'] before:mr-3 before:text-dc-muted first:before:content-none first:before:mr-0"
                >
                  <IdentityTag>{o}</IdentityTag>
                </li>
              ))}
              {lifestyleActivity ?
                <li className="before:content-['·'] before:mr-3 before:text-dc-muted first:before:content-none first:before:mr-0">
                  {lifestyleActivity}
                </li>
              : null}
              {memberSince ?
                <li className="before:content-['·'] before:mr-3 before:text-dc-muted first:before:content-none first:before:mr-0">
                  Member since {memberSince}
                </li>
              : null}
            </ul>

            {roles.length > 0 || badges.length > 0 ?
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="px-2.5 py-0.5 text-xs font-medium bg-dc-accent/15 text-dc-accent border border-dc-accent-border/30 rounded-full"
                  >
                    {role}
                  </span>
                ))}
                <BadgeDisplay badges={badges} maxVisible={4} size="sm" />
              </div>
            : null}

            <div className="mt-4">{actions}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
