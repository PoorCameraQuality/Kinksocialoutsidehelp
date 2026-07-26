import { Link } from 'react-router-dom'
import MobileActionBar from '@/components/shell/MobileActionBar'

type Props = {
  status: string
  saving: boolean
  hasUnsavedChanges: boolean
  hint?: string
  onSave: () => void
  onDiscard?: () => void
}

export default function ProfileStudioSaveBar({
  status,
  saving,
  hasUnsavedChanges,
  onSave,
  onDiscard,
}: Props) {
  return (
    <MobileActionBar
      status={status}
      secondary={
        hasUnsavedChanges && onDiscard ?
          { label: 'Discard changes', onClick: onDiscard, variant: 'secondary' }
        : undefined
      }
      primary={{
        label: saving ? 'Saving…' : 'Save changes',
        onClick: onSave,
        loading: saving,
        disabled: saving || !hasUnsavedChanges,
      }}
      trailing={
        <Link
          to="/profile"
          className="inline-flex min-h-touch items-center rounded-lg border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
        >
          Done
        </Link>
      }
    />
  )
}
