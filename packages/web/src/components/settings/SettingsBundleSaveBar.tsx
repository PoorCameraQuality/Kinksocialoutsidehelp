import Button from '@/components/ui/Button'
import StatusBanner from '@/components/ui/StatusBanner'
import { useSettingsContext } from '@/app/settings/SettingsContext'

type Props = {
  profilePrivacyNote?: boolean
}

export default function SettingsBundleSaveBar({ profilePrivacyNote = false }: Props) {
  const { saveError, saving, saved, saveSettings } = useSettingsContext()

  return (
    <div className="mt-8 space-y-3 border-t border-dc-border pt-6">
      {saveError ? <StatusBanner tone="error">{saveError}</StatusBanner> : null}
      {saved ? <StatusBanner tone="success">Saved.</StatusBanner> : null}
      <Button type="button" disabled={saving} onClick={() => void saveSettings()}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
      {profilePrivacyNote ?
        <p className="text-xs text-dc-muted">
          Also saves profile field visibility, location visibility, and people-search discoverability from this page.
        </p>
      : null}
    </div>
  )
}
