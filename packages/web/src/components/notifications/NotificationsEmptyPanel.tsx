import EmptyState, { type EmptyStateAction } from '@/components/ui/EmptyState'
import { NotificationEmptyIcon } from '@/components/ui/empty-state-icons'

type Props = {
  title: string
  message: string
  actions?: EmptyStateAction[]
  className?: string
}

/** Notifications and connections empty panel — thin wrapper over shared EmptyState. */
export default function NotificationsEmptyPanel({ title, message, actions, className = '' }: Props) {
  return (
    <EmptyState
      variant="surface"
      className={className}
      titleAs="h2"
      icon={<NotificationEmptyIcon />}
      title={title}
      message={message}
      actions={actions}
    />
  )
}
