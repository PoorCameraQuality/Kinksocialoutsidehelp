import { Link } from 'react-router-dom'
import ProfileCard from './ProfileCard'
import ProfilePill from './ProfilePill'
import { profileStoryBodyText } from './profile-story-classes'
import { IconHeart } from './ProfileStoryIcons'

type Props = {
  lookingFor: string[]
  viewerIsOwner: boolean
}

export default function ProfileLookingForCard({ lookingFor, viewerIsOwner }: Props) {
  if (lookingFor.length === 0) {
    if (!viewerIsOwner) return null
    return (
      <ProfileCard title="Looking For" icon={<IconHeart />}>
        <p className={profileStoryBodyText}>
          Share what kinds of connections you are open to — friends, event companions, study partners, and more.
        </p>
        <Link to="/profile/edit/looking-for" className="mt-3 inline-block text-sm font-medium text-dc-accent hover:underline">
          Edit connection goals
        </Link>
      </ProfileCard>
    )
  }

  return (
    <ProfileCard title="Looking For" icon={<IconHeart />}>
      <ul className="flex flex-wrap gap-2.5">
        {lookingFor.map((goal) => (
          <li key={goal}>
            <ProfilePill>{goal}</ProfilePill>
          </li>
        ))}
      </ul>
    </ProfileCard>
  )
}
