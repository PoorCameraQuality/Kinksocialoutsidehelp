import SettingsBundleSaveBar from '@/components/settings/SettingsBundleSaveBar'
import SettingsActivityFeedSections from '@/components/settings/SettingsActivityFeedSections'
import { useSettingsContext } from '../SettingsContext'

export default function SettingsActivityPage() {
  const ctx = useSettingsContext()
  if (!ctx.feed) return null

  return (
    <div className="space-y-6">
      <SettingsActivityFeedSections feed={ctx.feed} onFeedChange={(next) => ctx.setFeed(next)} />
      <SettingsBundleSaveBar />
    </div>
  )
}
