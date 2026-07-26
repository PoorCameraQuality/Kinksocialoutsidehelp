import { Link } from 'react-router-dom'
import { Panel } from '@/components/dancecard/ui/Panel'
import type { NotificationSettings } from '@c2k/shared'
import { setAllMatrixChannels } from '@/components/settings/notificationMatrix'

type Props = {
  notifications: NotificationSettings
  onChange: (next: NotificationSettings) => void
}

export default function SettingsNotificationBulkSidebar({ notifications, onChange }: Props) {
  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <Panel className="!p-4">
        <h2 className="text-sm font-semibold text-dc-text">Bulk edit</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <button
              type="button"
              className="text-dc-accent hover:underline"
              onClick={() => onChange(setAllMatrixChannels(notifications, 'push', true))}
            >
              Enable all push
            </button>
          </li>
          <li>
            <button
              type="button"
              className="text-dc-accent hover:underline"
              onClick={() => onChange(setAllMatrixChannels(notifications, 'push', false))}
            >
              Disable all push
            </button>
          </li>
          <li>
            <button
              type="button"
              className="text-dc-accent hover:underline"
              onClick={() => onChange(setAllMatrixChannels(notifications, 'email', true))}
            >
              Enable all email
            </button>
          </li>
          <li>
            <button
              type="button"
              className="text-dc-accent hover:underline"
              onClick={() => onChange(setAllMatrixChannels(notifications, 'email', false))}
            >
              Disable all email
            </button>
          </li>
        </ul>
      </Panel>
      <Panel className="!p-4">
        <h2 className="text-sm font-semibold text-dc-text">Push on this device</h2>
        <p className="mt-2 text-xs text-dc-muted leading-relaxed">
          Browser push works on recent Chrome, Firefox, Edge, and Safari on desktop. On iOS, add Kink Social to your home screen
          first, then enable push here.
        </p>
        <p className="mt-2 text-xs text-dc-muted">
          To turn push off later, use your browser&apos;s site notification settings for this origin.
        </p>
      </Panel>
      <Panel className="!p-4">
        <h2 className="text-sm font-semibold text-dc-text">Per-group overrides</h2>
        <p className="mt-2 text-xs text-dc-muted leading-relaxed">
          Fine-grained toggles for each group you belong to will live here once group notification prefs ship. For now,
          mute forums from the group page or adjust group invitations above.
        </p>
        <Link to="/groups" className="mt-3 inline-block text-xs text-dc-accent hover:underline">
          Browse groups
        </Link>
      </Panel>
    </div>
  )
}
