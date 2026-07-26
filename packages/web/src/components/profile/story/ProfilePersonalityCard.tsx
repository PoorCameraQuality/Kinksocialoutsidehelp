import ProfileCard from './ProfileCard'
import { profileStoryBodyText } from './profile-story-classes'
import { IconUser } from './ProfileStoryIcons'

type Props = {
  paragraph: string | null
  displayName: string
}

export default function ProfilePersonalityCard({ paragraph, displayName }: Props) {
  if (!paragraph?.trim()) return null

  return (
    <ProfileCard title="A Few Things About Me" icon={<IconUser />}>
      <p className={`${profileStoryBodyText} whitespace-pre-wrap`}>{paragraph}</p>
      <p className="mt-4 text-xs leading-relaxed text-dc-muted/80">Conversation starters from {displayName}&apos;s profile.</p>
    </ProfileCard>
  )
}
