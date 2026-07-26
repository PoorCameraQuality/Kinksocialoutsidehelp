'use client'

import { LocationsSettingsSection } from '@/components/dancecard/organizer/LocationsSettingsSection'
import { MapsSettingsSection } from '@/components/dancecard/organizer/MapsSettingsSection'
import { Panel } from '@/components/dancecard/ui/Panel'

export function VenuesSetupPanel({
  eventSlug,
  canEdit,
  onChanged,
}: {
  eventSlug: string
  canEdit: boolean
  onChanged?: () => void
}) {
  return (
    <div className="space-y-6">
      <Panel className="!p-0 overflow-visible">
        <LocationsSettingsSection eventSlug={eventSlug} canEdit={canEdit} variant="compact" onChanged={onChanged} />
      </Panel>
      <Panel className="!p-0 overflow-visible">
        <MapsSettingsSection eventSlug={eventSlug} canEdit={canEdit} embedded onChanged={onChanged} />
      </Panel>
    </div>
  )
}
