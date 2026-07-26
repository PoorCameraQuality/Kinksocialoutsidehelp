import ProfileCard from '@/components/profile/story/ProfileCard'
import { profileStudioSectionCardClass } from './profile-studio-classes'
import { IconUser } from '@/components/profile/story/ProfileStoryIcons'

type Props = {
  readout: string
}

export default function ProfileStudioVisitorReadout({ readout }: Props) {
  return (
    <ProfileCard title="How visitors read this" icon={<IconUser />} className={profileStudioSectionCardClass}>
      <p className="text-sm leading-relaxed text-dc-text-muted">{readout}</p>
    </ProfileCard>
  )
}
