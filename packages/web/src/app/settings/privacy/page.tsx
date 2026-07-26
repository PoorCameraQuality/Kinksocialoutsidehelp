import SettingsBundleSaveBar from '@/components/settings/SettingsBundleSaveBar'
import SettingsPrivacyDataPanel from '@/components/settings/SettingsPrivacyDataPanel'
import SettingsPrivacySidebar from '@/components/settings/SettingsPrivacySidebar'
import SettingsFeedActivityPrivacyPanel from '@/components/settings/SettingsFeedActivityPrivacyPanel'
import SettingsMediaPrivacyPanel from '@/components/settings/SettingsMediaPrivacyPanel'
import {
  SettingsEventHistoryPanel,
  SettingsConnectionsListPanel,
  SettingsFollowingPanel,
  SettingsInboxPanel,
  SettingsDataRetentionPanel,
  SettingsLocationVisibilityPanel,
  SettingsProfileFieldsPanel,
  SettingsRequestsPanel,
  SettingsSearchDiscoveryPanel,
} from '../SettingsPrivacySections'
import { useSettingsContext } from '../SettingsContext'

export default function SettingsPrivacyPage() {
  const ctx = useSettingsContext()
  if (!ctx.privacy) return null

  const onPrivacyChange = (next: typeof ctx.privacy) => {
    if (!next) return
    ctx.setPrivacy(next)
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8 lg:items-start">
      <div className="space-y-6">
        <header className="lg:hidden">
          <p className="text-sm leading-relaxed text-dc-muted">
            Choose who can see your profile, activity, messages, and how you appear in search.
          </p>
        </header>
        <SettingsFollowingPanel privacy={ctx.privacy} onPrivacyChange={onPrivacyChange} />
        <SettingsRequestsPanel privacy={ctx.privacy} onPrivacyChange={onPrivacyChange} />
        <SettingsSearchDiscoveryPanel
          privacy={ctx.privacy}
          onPrivacyChange={onPrivacyChange}
          profDiscoverable={ctx.profDiscoverable}
          onProfDiscoverableChange={ctx.setProfDiscoverable}
          profVisibility={ctx.profVisibility}
          onProfVisibilityChange={ctx.setProfVisibility}
          profSectionLoading={ctx.profSectionLoading}
        />
        <SettingsLocationVisibilityPanel
          fvLocation={ctx.fvLocation}
          onFvLocationChange={ctx.setFvLocation}
          locationLabel={ctx.profLocationLabel}
          displayName={ctx.profDisplayName}
          username={ctx.viewerUsername}
          profSectionLoading={ctx.profSectionLoading}
        />
        <SettingsEventHistoryPanel privacy={ctx.privacy} onPrivacyChange={onPrivacyChange} />
        <SettingsConnectionsListPanel privacy={ctx.privacy} onPrivacyChange={onPrivacyChange} />
        <SettingsFeedActivityPrivacyPanel privacy={ctx.privacy} onPrivacyChange={onPrivacyChange} />
        <SettingsMediaPrivacyPanel privacy={ctx.privacy} onPrivacyChange={onPrivacyChange} />
        <SettingsInboxPanel privacy={ctx.privacy} onPrivacyChange={onPrivacyChange} />
        <SettingsDataRetentionPanel privacy={ctx.privacy} onPrivacyChange={onPrivacyChange} />
        <SettingsProfileFieldsPanel
          profSectionLoading={ctx.profSectionLoading}
          fvGender={ctx.fvGender}
          onFvGenderChange={ctx.setFvGender}
          fvAge={ctx.fvAge}
          onFvAgeChange={ctx.setFvAge}
          fvSexuality={ctx.fvSexuality}
          onFvSexualityChange={ctx.setFvSexuality}
          fvPronouns={ctx.fvPronouns}
          onFvPronounsChange={ctx.setFvPronouns}
          profPrivacyError={ctx.profPrivacyError}
          profPrivacySaved={ctx.profPrivacySaved}
          profPrivacySaving={ctx.profPrivacySaving}
          onSaveProfilePrivacy={() => void ctx.saveProfilePrivacy()}
        />
        <SettingsPrivacyDataPanel />
        <SettingsBundleSaveBar profilePrivacyNote />
      </div>
      <aside className="mt-8 lg:mt-0">
        <SettingsPrivacySidebar />
      </aside>
    </div>
  )
}
