import DancecardAppearancePicker from '@/components/dancecard/DancecardAppearancePicker'
import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import { useDancecardAppearance } from '@/components/dancecard/DancecardAppearanceContext'

export default function SettingsAppearanceSection() {
  const { preset } = useDancecardAppearance()

  return (
    <Panel className="scroll-mt-24">
      <SectionHeader
        eyebrow="Comfort"
        title="Appearance"
        description="Choose how the site looks on this device. Your choice is saved here only."
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DancecardAppearancePicker className="w-full sm:w-auto" />
        <p className="text-xs text-dc-muted sm:max-w-xs sm:text-right">
          {preset.tagline}. Best for {preset.bestFor.toLowerCase()}.
        </p>
      </div>
    </Panel>
  )
}
