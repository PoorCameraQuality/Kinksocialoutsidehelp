import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { ProfilePhotoDisplaySettings } from '@c2k/shared'
import type { UserEcosystemPayload } from '@/lib/user-ecosystem'
import type { ProfileStoryKink } from '@/lib/profile-story/types'
import {
  buildStudioCompletionFromStory,
  deriveStudioBoosters,
  deriveStudioEssentials,
  deriveStudioNextSteps,
  deriveStudioStrengthScore,
} from '@/lib/profile-studio/completion'
import {
  derivePersonalityParagraph,
  deriveProfileTagline,
} from '@/lib/profile-story/derive'
import ProfileHeroCard from './ProfileHeroCard'
import ProfileAboutCard from './ProfileAboutCard'
import ProfileLookingForCard from './ProfileLookingForCard'
import ProfilePersonalityCard from './ProfilePersonalityCard'
import ProfileStudioStrengthCard from '../studio/ProfileStudioStrengthCard'
import ProfileCommunitySnapshotCard from './ProfileCommunitySnapshotCard'
import ProfileOrganizationsCard from './ProfileOrganizationsCard'
import ProfileUpcomingEventsCard from './ProfileUpcomingEventsCard'

export type ProfileStoryViewProps = {
  displayName: string
  username: string
  bio: string | null
  location: string
  ageLabel?: string
  pronouns?: string
  genders?: string[]
  sexualOrientations?: string[]
  romanticOrientations?: string[]
  roles: string[]
  lookingFor: string[]
  kinks: ProfileStoryKink[]
  lifestyleActivity?: string | null
  memberSince?: string | null
  photoUrl?: string | null
  photoCaption?: string | null
  photoDisplaySettings?: ProfilePhotoDisplaySettings | null
  photoCount?: number
  onOpenGallery?: () => void
  ecosystem: UserEcosystemPayload | null
  references: { createdAt: string; referrerUsername: string }[]
  referencesCount: number
  eventsAttended?: number
  educationContributions?: number
  viewerIsOwner: boolean
  linksCount?: number
  relationshipsCount?: number
  pronounTags?: string[]
  heroActions: ReactNode
  onAddReference?: () => void
  canOfferReference?: boolean
}

export default function ProfileStoryView(props: ProfileStoryViewProps) {
  const [linksCount, setLinksCount] = useState(props.linksCount ?? 0)

  useEffect(() => {
    if (props.linksCount != null) {
      setLinksCount(props.linksCount)
      return
    }
    if (!props.viewerIsOwner) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/profile/me/links', { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { links?: unknown[] }
        if (!cancelled) setLinksCount(Array.isArray(data.links) ? data.links.length : 0)
      } catch {
        /* keep last value */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [props.linksCount, props.viewerIsOwner])

  const tagline = deriveProfileTagline(props.bio)
  const interests = props.kinks.map((k) => k.displayName)
  const personality = derivePersonalityParagraph({
    bio: props.bio,
    lifestyleActivity: props.lifestyleActivity,
    kinks: props.kinks,
    presenterHeadline: props.ecosystem?.presenter?.headline,
  })
  const completionInput = useMemo(
    () =>
      buildStudioCompletionFromStory({
        displayName: props.displayName,
        bio: props.bio,
        location: props.location,
        photoUrl: props.photoUrl ?? undefined,
        photoCount: props.photoCount,
        roles: props.roles,
        lifestyleActivity: props.lifestyleActivity,
        lookingFor: props.lookingFor,
        kinksCount: props.kinks.length,
        linksCount,
        relationshipsCount: props.relationshipsCount ?? 0,
        pronounTags: props.pronounTags,
      }),
    [
      props.displayName,
      props.bio,
      props.location,
      props.photoUrl,
      props.photoCount,
      props.roles,
      props.lifestyleActivity,
      props.lookingFor,
      props.kinks.length,
      linksCount,
      props.relationshipsCount,
      props.pronounTags,
    ],
  )
  const essentials = useMemo(() => deriveStudioEssentials(completionInput), [completionInput])
  const boosters = useMemo(() => deriveStudioBoosters(completionInput), [completionInput])
  const strengthScore = useMemo(
    () => deriveStudioStrengthScore(essentials, boosters),
    [essentials, boosters],
  )
  const nextSteps = useMemo(() => deriveStudioNextSteps(boosters), [boosters])

  const lookingForCard = (
    <ProfileLookingForCard lookingFor={props.lookingFor} viewerIsOwner={props.viewerIsOwner} />
  )
  const showHeroRail = props.viewerIsOwner || props.lookingFor.length > 0

  const communityCards = (
    <>
      <ProfileUpcomingEventsCard
        ecosystem={props.ecosystem}
        username={props.username}
        viewerIsOwner={props.viewerIsOwner}
      />
      <ProfileOrganizationsCard ecosystem={props.ecosystem} username={props.username} />
    </>
  )

  const strengthFull =
    props.viewerIsOwner ?
      <ProfileStudioStrengthCard
        score={strengthScore}
        essentials={essentials}
        boosters={boosters}
        nextSteps={nextSteps}
      />
    : null

  const strengthCompact =
    props.viewerIsOwner ?
      <ProfileStudioStrengthCard
        score={strengthScore}
        essentials={essentials}
        boosters={boosters}
        nextSteps={nextSteps}
        compact
      />
    : null

  const snapshotCard = (
    <ProfileCommunitySnapshotCard
      ecosystem={props.ecosystem}
      memberSince={props.memberSince}
      roles={props.roles}
      lifestyleActivity={props.lifestyleActivity}
      eventsAttended={props.eventsAttended}
    />
  )

  return (
    <div className="flex flex-col gap-5 lg:gap-8">
      {/* Hero + connection goals */}
      <div
        className={
          showHeroRail ?
            'grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] lg:items-start lg:gap-8'
          : undefined
        }
      >
        <ProfileHeroCard
          displayName={props.displayName}
          username={props.username}
          tagline={tagline}
          location={props.location}
          ageLabel={props.ageLabel}
          pronouns={props.pronouns}
          genders={props.genders}
          sexualOrientations={props.sexualOrientations}
          romanticOrientations={props.romanticOrientations}
          roles={props.roles}
          photoUrl={props.photoUrl ?? undefined}
          photoCaption={props.photoCaption ?? undefined}
          photoDisplaySettings={props.photoDisplaySettings ?? undefined}
          photoCount={props.photoCount ?? 0}
          onOpenGallery={props.onOpenGallery}
          actions={props.heroActions}
        />
        {showHeroRail ?
          <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
            {lookingForCard}
          </aside>
        : null}
      </div>

      {/* About + interests with profile strength / snapshot rail */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] lg:items-start lg:gap-8">
        <ProfileAboutCard
          displayName={props.displayName}
          bio={props.bio}
          interests={interests}
          viewerIsOwner={props.viewerIsOwner}
        />
        <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          {snapshotCard}
          <div className="hidden lg:block">{strengthFull}</div>
          <div className="lg:hidden">{strengthCompact}</div>
        </aside>
      </div>

      <div className="grid gap-5 max-lg:order-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">{communityCards}</div>

      <div className="max-lg:order-7 lg:order-none">
        <ProfilePersonalityCard paragraph={personality} displayName={props.displayName} />
      </div>
    </div>
  )
}

/** Map full story props into desktop cover + sidebar slices. */
export function buildProfileStoryLayoutArgs(props: ProfileStoryViewProps) {
  return {
    cover: {
      displayName: props.displayName,
      username: props.username,
      tagline: deriveProfileTagline(props.bio),
      location: props.location,
      ageLabel: props.ageLabel,
      pronouns: props.pronouns,
      genders: props.genders,
      sexualOrientations: props.sexualOrientations,
      romanticOrientations: props.romanticOrientations,
      roles: props.roles,
      photoUrl: props.photoUrl ?? undefined,
      photoCaption: props.photoCaption,
      photoDisplaySettings: props.photoDisplaySettings,
      photoCount: props.photoCount,
      onOpenGallery: props.onOpenGallery,
      actions: props.heroActions,
    },
    sidebar: {
      displayName: props.displayName,
      username: props.username,
      bio: props.bio,
      location: props.location,
      roles: props.roles,
      lookingFor: props.lookingFor,
      kinks: props.kinks,
      lifestyleActivity: props.lifestyleActivity,
      memberSince: props.memberSince,
      photoUrl: props.photoUrl ?? undefined,
      ecosystem: props.ecosystem,
      referencesCount: props.referencesCount,
      eventsAttended: props.eventsAttended,
      educationContributions: props.educationContributions,
      viewerIsOwner: props.viewerIsOwner,
      linksCount: props.linksCount,
      relationshipsCount: props.relationshipsCount,
      pronounTags: props.pronounTags,
      onAddReference: props.onAddReference,
      canOfferReference: props.canOfferReference,
    },
  }
}
