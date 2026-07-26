import SettingsBundleSaveBar from '@/components/settings/SettingsBundleSaveBar'
import SettingsNotificationBulkSidebar from '@/components/settings/SettingsNotificationBulkSidebar'
import SettingsNotificationMatrix from '@/components/settings/SettingsNotificationMatrix'
import SettingsPushBuildNote from '@/components/settings/SettingsPushBuildNote'
import SettingsPushEnableBanner from '@/components/settings/SettingsPushEnableBanner'
import { useSettingsContext } from '../SettingsContext'

export default function SettingsNotificationsPage() {
  const ctx = useSettingsContext()
  if (!ctx.notifications) return null

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8 lg:items-start">
      <div className="space-y-6">
        <SettingsPushEnableBanner />
        <SettingsPushBuildNote />
        <SettingsNotificationMatrix
          notifications={ctx.notifications}
          onChange={(next) => ctx.setNotifications(next)}
        />
        <SettingsBundleSaveBar />
      </div>
      <aside className="mt-8 lg:mt-0">
        <SettingsNotificationBulkSidebar
          notifications={ctx.notifications}
          onChange={(next) => ctx.setNotifications(next)}
        />
      </aside>
    </div>
  )
}
