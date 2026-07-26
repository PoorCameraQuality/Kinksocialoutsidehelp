import PresenterProfileSection from '@/components/settings/PresenterProfileSection'
import SettingsStaffSection from '@/components/settings/SettingsStaffSection'
import SettingsSupportSection from '@/components/settings/SettingsSupportSection'
import { useSettingsContext } from '../SettingsContext'

export default function SettingsEcosystemPage() {
  const { settingsEnabled } = useSettingsContext()

  return (
    <div className="space-y-6">
      <PresenterProfileSection />
      <SettingsStaffSection enabled={settingsEnabled} />
      <SettingsSupportSection enabled={settingsEnabled} />
    </div>
  )
}
