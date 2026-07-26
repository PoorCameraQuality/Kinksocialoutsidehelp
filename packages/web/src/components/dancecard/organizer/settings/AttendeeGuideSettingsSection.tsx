'use client'

import type { AttendeeGuideJson } from '@/lib/dancecard/attendeeGuideJson'
import { SETTINGS_FIELD_CLASS, SETTINGS_LABEL_CLASS } from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import { Panel } from '@/components/dancecard/ui/Panel'

export function AttendeeGuideSettingsSection({
  guide,
  onChange,
  disabled,
}: {
  guide: AttendeeGuideJson
  onChange: (next: AttendeeGuideJson) => void
  disabled?: boolean
}) {
  return (
    <Panel className="space-y-4">
      <p className="text-sm text-dc-muted">
        Links and copy for your attendee weekend guide. Empty fields are hidden on the public dancecard.
      </p>
      <label className={SETTINGS_LABEL_CLASS}>
        External ticketing URL
        <input
          type="url"
          className={SETTINGS_FIELD_CLASS}
          disabled={disabled}
          value={guide.ticketingUrl ?? ''}
          placeholder="https://"
          onChange={(e) => onChange({ ...guide, ticketingUrl: e.target.value || undefined })}
        />
      </label>
      <label className={SETTINGS_LABEL_CLASS}>
        RabbitSign URL (optional)
        <input
          type="url"
          className={SETTINGS_FIELD_CLASS}
          disabled={disabled}
          value={guide.rabbitsignUrl ?? ''}
          placeholder="https://"
          onChange={(e) => onChange({ ...guide, rabbitsignUrl: e.target.value || undefined })}
        />
      </label>
      <label className={SETTINGS_LABEL_CLASS}>
        Check-in info (markdown)
        <textarea
          className={`${SETTINGS_FIELD_CLASS} min-h-[120px] font-mono text-xs`}
          disabled={disabled}
          value={guide.checkInMarkdown ?? ''}
          onChange={(e) => onChange({ ...guide, checkInMarkdown: e.target.value })}
        />
      </label>
    </Panel>
  )
}
