import { Link } from 'react-router-dom'
import ConnectionGoalsEditor from '@/components/profile/edit/ConnectionGoalsEditor'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import ProfileStudioSectionCard from '@/components/profile/studio/ProfileStudioSectionCard'
import { IconHeart } from '@/components/profile/story/ProfileStoryIcons'
import { useProfileEdit } from '@/contexts/ProfileEditContext'

export default function LookingForPanel() {
  const ctx = useProfileEdit()

  return (
    <ProfileStudioSectionCard
      title="Looking For"
      description="These help people know whether it makes sense to reach out — friends, event companions, study partners, and more."
      icon={<IconHeart />}
    >
      <ProfileStudioInsetCard>
        <ConnectionGoalsEditor selected={ctx.lookingFor} onChange={ctx.setLookingFor} />
      </ProfileStudioInsetCard>
      <p className="mt-4 text-xs leading-relaxed text-dc-muted">
        Selected goals appear on your public profile. You can change these anytime. For field-level privacy, see{' '}
        <Link to="/profile/edit/privacy" className="text-dc-accent hover:underline">
          Privacy & visibility
        </Link>
        .
      </p>
    </ProfileStudioSectionCard>
  )
}
