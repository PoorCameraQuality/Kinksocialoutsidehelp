import type { NotificationSettings } from '@c2k/shared'
import { NotificationMatrixTable } from '@/components/settings/NotificationMatrixTable'

type Props = {
  notifications: NotificationSettings
  onChange: (next: NotificationSettings) => void
}

export default function SettingsNotificationMatrix({ notifications, onChange }: Props) {
  return <NotificationMatrixTable notifications={notifications} onChange={onChange} />
}
