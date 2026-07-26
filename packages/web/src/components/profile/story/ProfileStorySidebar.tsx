import { useEffect, useMemo, useState } from 'react'

import type { UserEcosystemPayload } from '@/lib/user-ecosystem'
import type { ProfileStoryKink } from '@/lib/profile-story/types'
import {
  buildStudioCompletionFromStory,
  deriveStudioBoosters,
  deriveStudioEssentials,
  deriveStudioNextSteps,
  deriveStudioStrengthScore,
} from '@/lib/profile-studio/completion'
import ProfileAboutCard from './ProfileAboutCard'
import ProfileLookingForCard from './ProfileLookingForCard'
import ProfileStudioStrengthCard from '../studio/ProfileStudioStrengthCard'
import ProfileCommunitySnapshotCard from './ProfileCommunitySnapshotCard'
import ProfileOrganizationsCard from './ProfileOrganizationsCard'
import ProfileUpcomingEventsCard from './ProfileUpcomingEventsCard'

export type ProfileStorySidebarProps = {
  displayName: string
  username: string
  bio: string | null
  location: string
  roles: string[]
  lookingFor: string[]
  kinks: ProfileStoryKink[]
  lifestyleActivity?: string | null
  memberSince?: string | null
  photoUrl?: string | null
  ecosystem: UserEcosystemPayload | null
  referencesCount: number
  eventsAttended?: number
  educationContributions?: number
  viewerIsOwner: boolean
  linksCount?: number
  relationshipsCount?: number
  pronounTags?: string[]
  onAddReference?: () => void
  canOfferReference?: boolean
}

/** Desktop left rail — identity + activity summary; people/references live in Community tab. */
export default function ProfileStorySidebar(props: ProfileStorySidebarProps) {
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

  const interests = props.kinks.map((k) => k.displayName)

  const completionInput = useMemo(
    () =>
      buildStudioCompletionFromStory({
        displayName: props.displayName,
        bio: props.bio,
        location: props.location,
        photoUrl: props.photoUrl,
        photoCount: 0,
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

  return (
    <div className="space-y-4">
      <ProfileAboutCard
        displayName={props.displayName}
        bio={props.bio}
        interests={interests}
        viewerIsOwner={props.viewerIsOwner}
      />
      {props.viewerIsOwner || props.lookingFor.length > 0 ?
        <ProfileLookingForCard lookingFor={props.lookingFor} viewerIsOwner={props.viewerIsOwner} />
      : null}
      <ProfileCommunitySnapshotCard
        ecosystem={props.ecosystem}
        memberSince={props.memberSince}
        roles={props.roles}
        lifestyleActivity={props.lifestyleActivity}
        eventsAttended={props.eventsAttended}
      />
      {props.viewerIsOwner ?
        <ProfileStudioStrengthCard
          score={strengthScore}
          essentials={essentials}
          boosters={boosters}
          nextSteps={nextSteps}
        />
      : null}
      <ProfileUpcomingEventsCard
        ecosystem={props.ecosystem}
        username={props.username}
        viewerIsOwner={props.viewerIsOwner}
      />
      <ProfileOrganizationsCard ecosystem={props.ecosystem} username={props.username} />
    </div>
  )
}
