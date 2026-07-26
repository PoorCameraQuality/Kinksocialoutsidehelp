import { Link } from 'react-router-dom'
import { PresetEmptyState } from '@/components/ui/empty-state-presets'

export default function SavedEmptyPanel() {
  return (
    <PresetEmptyState
      preset="noSavedItems"
      variant="surface"
      footer={
        <Link to="/media" className="text-sm font-medium text-dc-accent hover:underline">
          Media hub
        </Link>
      }
    />
  )
}
