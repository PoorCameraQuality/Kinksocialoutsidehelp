import { Link } from 'react-router-dom'

import MarkdownContent from '@/components/ui/MarkdownContent'

import ProfileCard from './ProfileCard'

import ProfilePill from './ProfilePill'

import { profileStoryBodyText, profileStoryEyebrow } from './profile-story-classes'

import { IconUser } from './ProfileStoryIcons'

type Props = {
  displayName: string
  bio: string | null
  interests: string[]
  viewerIsOwner: boolean
}

function InterestsSection({
  interests,
  viewerIsOwner,
  withDivider,
}: {
  interests: string[]
  viewerIsOwner: boolean
  withDivider: boolean
}) {
  if (interests.length === 0) {
    if (!viewerIsOwner) return null
    return (
      <div className={withDivider ? 'mt-5 border-t border-white/[0.06] pt-5' : undefined}>
        <p className={profileStoryEyebrow}>Interests</p>
        <p className={`mt-2 ${profileStoryBodyText}`}>Add interests to help people find shared context.</p>
        <Link
          to="/profile/edit/interests"
          className="mt-3 inline-block text-sm font-medium text-dc-accent hover:underline"
        >
          Edit interests
        </Link>
      </div>
    )
  }

  return (
    <div className={withDivider ? 'mt-5 border-t border-white/[0.06] pt-5' : undefined}>
      <p className={profileStoryEyebrow}>Interests</p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {interests.map((tag) => (
          <ProfilePill key={tag} variant="muted">
            {tag}
          </ProfilePill>
        ))}
      </div>
    </div>
  )
}

export default function ProfileAboutCard({ displayName, bio, interests, viewerIsOwner }: Props) {
  const hasBio = Boolean(bio?.trim())
  const hasInterests = interests.length > 0

  if (!hasBio && !hasInterests && !viewerIsOwner) {
    return (
      <ProfileCard title={`About ${displayName}`} icon={<IconUser />}>
        <p className={profileStoryBodyText}>{displayName} has not added an about section yet.</p>
      </ProfileCard>
    )
  }

  if (!hasBio && !hasInterests && viewerIsOwner) {
    return (
      <ProfileCard title={`About ${displayName}`} icon={<IconUser />}>
        <p className={profileStoryBodyText}>
          Add a short intro so people understand who you are and what kind of connections you welcome.
        </p>
        <Link
          to="/profile/edit/about"
          className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Add about
        </Link>
        <InterestsSection interests={interests} viewerIsOwner={viewerIsOwner} withDivider />
      </ProfileCard>
    )
  }

  return (
    <ProfileCard title={`About ${displayName}`} icon={<IconUser />}>
      {hasBio ?
        <div className={`${profileStoryBodyText} [&_p]:mb-3 [&_p:last-child]:mb-0`}>
          <MarkdownContent markdown={bio!} />
        </div>
      : viewerIsOwner ?
        <>
          <p className={profileStoryBodyText}>
            Add a short intro so people understand who you are and what kind of connections you welcome.
          </p>
          <Link
            to="/profile/edit/about"
            className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Add about
          </Link>
        </>
      : null}

      <InterestsSection interests={interests} viewerIsOwner={viewerIsOwner} withDivider={hasBio} />
    </ProfileCard>
  )
}
