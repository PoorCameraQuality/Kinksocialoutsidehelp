import { Link } from 'react-router-dom'
import { PresetEmptyState } from '@/components/ui/empty-state-presets'

export default function MyPostsEmptyPanel() {
  return (
    <PresetEmptyState
      preset="noMyPosts"
      variant="surface"
      footer={
        <Link to="/events?create=event" className="text-sm font-medium text-dc-accent hover:underline">
          Create event
        </Link>
      }
    />
  )
}
