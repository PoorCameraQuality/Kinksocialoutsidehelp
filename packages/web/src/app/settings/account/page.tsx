import AccountAgeConfirmationPanel from '@/components/settings/AccountAgeConfirmationPanel'
import SettingsAppearanceSection from '../SettingsAppearanceSection'
import SettingsAccountSection, { SettingsAccountDangerPanel } from '../SettingsAccountSection'
import { useSettingsContext } from '../SettingsContext'

export default function SettingsAccountPage() {
  const { viewerUsername, viewerEmail, settingsEnabled, showModerationLink } = useSettingsContext()

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8 lg:space-y-0">
      <div className="space-y-6">
        <SettingsAccountSection
          viewerUsername={viewerUsername}
          viewerEmail={viewerEmail}
          apiBackedAccount={settingsEnabled}
          showModerationLink={showModerationLink}
        />
        <AccountAgeConfirmationPanel />
        <SettingsAppearanceSection />
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <SettingsAccountDangerPanel />
      </aside>
    </div>
  )
}
