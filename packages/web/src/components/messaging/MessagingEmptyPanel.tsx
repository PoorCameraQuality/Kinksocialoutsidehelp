import type { ReactNode } from 'react'
import EmptyState, { type EmptyStateAction } from '@/components/ui/EmptyState'
import { MessagingEmptyIcon, type MessagingEmptyIconKind } from '@/components/ui/empty-state-icons'

type Props = {
  icon?: MessagingEmptyIconKind
  title: string
  message: string
  actions?: EmptyStateAction[]
  footer?: ReactNode
  className?: string
  compact?: boolean
}

/** Messaging-specific empty panel — thin wrapper over shared EmptyState. */
export default function MessagingEmptyPanel({
  icon = 'inbox',
  title,
  message,
  actions,
  footer,
  className = '',
  compact = false,
}: Props) {
  return (
    <EmptyState
      variant="surface"
      compact={compact}
      className={className}
      titleAs="h2"
      icon={<MessagingEmptyIcon kind={icon} />}
      title={title}
      message={message}
      actions={actions}
      footer={footer}
    />
  )
}
