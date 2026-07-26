'use client'

import { Panel } from '@/components/dancecard/ui/Panel'
import {
  SETTINGS_FIELD_CLASS,
  SETTINGS_LABEL_CLASS,
} from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import {
  fromConventionDatetimeInput,
  toConventionDatetimeInput,
} from '@/lib/dancecard/eventWindowTime'
import { DatetimeLocalField } from '@/components/dancecard/organizer/ui/DatetimeLocalField'
import { EVENT_PROFILE_IDS, profileDisplayName, type EventProfileId } from '@/lib/dancecard/eventProfile'

type Props = {
  event: EventSettingsEventDto
  setEvent: React.Dispatch<React.SetStateAction<EventSettingsEventDto | null>>
  canEdit: boolean
  canOwnerSettings: boolean
  saveOnBlur: (patch: Partial<EventSettingsEventDto>) => void
  embedded?: boolean
}

function BasicsFields({ event, setEvent, canEdit, canOwnerSettings, saveOnBlur }: Props) {
  return (
    <>
      <label className={`${SETTINGS_LABEL_CLASS} sm:col-span-2`}>
        Event profile
        <select
          className={SETTINGS_FIELD_CLASS}
          value={event.eventProfile}
          disabled={!canEdit}
          onChange={(e) => {
            const eventProfile = e.target.value as EventProfileId
            setEvent((ev) => (ev ? { ...ev, eventProfile } : ev))
            saveOnBlur({ eventProfile })
          }}
        >
          {EVENT_PROFILE_IDS.map((id) => (
            <option key={id} value={id}>
              {profileDisplayName(id)}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs font-normal normal-case text-dc-muted">
          Adjusts labels like activity vs shift across the organizer console.
        </span>
      </label>
      <label className={`${SETTINGS_LABEL_CLASS} sm:col-span-2`}>
        Event title
        <input
          className={SETTINGS_FIELD_CLASS}
          value={event.eventTitle}
          disabled={!canEdit}
          onChange={(e) => setEvent((ev) => (ev ? { ...ev, eventTitle: e.target.value } : ev))}
          onBlur={() => saveOnBlur({ eventTitle: event.eventTitle })}
          placeholder="Sandbox Con 2026"
        />
      </label>
      <label className={SETTINGS_LABEL_CLASS}>
        Timezone
        <input
          className={SETTINGS_FIELD_CLASS}
          value={event.timezone}
          disabled={!canEdit}
          onChange={(e) => setEvent((ev) => (ev ? { ...ev, timezone: e.target.value } : ev))}
          onBlur={() => saveOnBlur({ timezone: event.timezone })}
          placeholder="America/New_York"
        />
        <span className="mt-1 block text-xs font-normal normal-case text-dc-muted">IANA name, e.g. America/New_York</span>
      </label>
      <label className={SETTINGS_LABEL_CLASS}>
        Live on public dancecard
        <select
          className={SETTINGS_FIELD_CLASS}
          value={event.status}
          disabled={!canOwnerSettings}
          onChange={(e) => {
            const status = e.target.value
            setEvent((ev) => (ev ? { ...ev, status } : ev))
            saveOnBlur({ status })
          }}
        >
          <option value="draft">Draft (organizers only)</option>
          <option value="published">Published (attendees can open)</option>
        </select>
      </label>
      <DatetimeLocalField
        variant="settings"
        label="Event starts"
        value={toConventionDatetimeInput(event.windowStartsAt, event.timezone)}
        disabled={!canEdit}
        hint={`Wall clock in ${event.timezone}.`}
        onChange={(v) => {
          const iso = fromConventionDatetimeInput(v, event.timezone)
          if (iso) setEvent((ev) => (ev ? { ...ev, windowStartsAt: iso } : ev))
        }}
        onBlur={() => saveOnBlur({ windowStartsAt: event.windowStartsAt })}
      />
      <DatetimeLocalField
        variant="settings"
        label="Event ends"
        value={toConventionDatetimeInput(event.windowEndsAt, event.timezone)}
        disabled={!canEdit}
        hint={`Wall clock in ${event.timezone}.`}
        onChange={(v) => {
          const iso = fromConventionDatetimeInput(v, event.timezone)
          if (iso) setEvent((ev) => (ev ? { ...ev, windowEndsAt: iso } : ev))
        }}
        onBlur={() => saveOnBlur({ windowEndsAt: event.windowEndsAt })}
      />
      <p className="sm:col-span-2 text-xs leading-relaxed text-dc-muted">
        The event window defines when program, room grid, and DM coverage tools are active. Set these before building
        your schedule.
      </p>
    </>
  )
}

export function EventSettingsBasicsForm(props: Props) {
  const grid = 'grid gap-4 sm:grid-cols-2'
  if (props.embedded) {
    return (
      <div className={grid}>
        <BasicsFields {...props} />
      </div>
    )
  }
  return (
    <Panel className={grid}>
      <BasicsFields {...props} />
    </Panel>
  )
}
