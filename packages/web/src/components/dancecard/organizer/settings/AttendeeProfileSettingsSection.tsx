'use client'

import type { AttendeeProfileConfig } from '@/lib/dancecard/attendeeProfile'
import { SETTINGS_FIELD_CLASS, SETTINGS_LABEL_CLASS } from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import { cn } from '@/lib/cn'

type ToggleKey = keyof Pick<
  AttendeeProfileConfig,
  'photo' | 'bio' | 'pronouns' | 'fetlife' | 'discord' | 'telegram' | 'emailOnCard'
>

const TOGGLES: Array<{ key: ToggleKey; label: string; hint?: string }> = [
  { key: 'photo', label: 'Profile photo', hint: 'Shown on compare & share' },
  { key: 'bio', label: 'Short bio' },
  { key: 'pronouns', label: 'Pronouns on card' },
  { key: 'fetlife', label: 'FetLife username', hint: 'Link out from compare' },
  { key: 'discord', label: 'Discord handle' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'emailOnCard', label: 'Email on card', hint: 'Keep email for organizer mail only when off' },
]

export function AttendeeProfileSettingsSection({
  config,
  onChange,
  disabled,
}: {
  config: AttendeeProfileConfig
  onChange: (next: AttendeeProfileConfig) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Attendee dancecard profile</p>
        <p className="mt-1 text-sm text-dc-muted">
          Controls what registrants can add on the Profile tab. Data is stored per account and shown on Compare when both
          people are signed in.
        </p>
      </div>

      <ul className="space-y-2">
        {TOGGLES.map((t) => (
          <li
            key={t.key}
            className="flex items-start justify-between gap-4 rounded-xl border border-dc-border bg-dc-surface-muted/60 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-dc-text">{t.label}</p>
              {t.hint ? <p className="text-xs text-dc-muted">{t.hint}</p> : null}
            </div>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider disabled:opacity-40',
                config[t.key]
                  ? 'bg-dc-success-muted text-dc-success'
                  : 'bg-dc-elevated-muted text-dc-muted'
              )}
              onClick={() => onChange({ ...config, [t.key]: !config[t.key] })}
            >
              {config[t.key] ? 'On' : 'Off'}
            </button>
          </li>
        ))}
      </ul>

      <div>
        <label htmlFor="attendee-bio-max-length" className={SETTINGS_LABEL_CLASS}>
          Bio max length
        </label>
        <input
          id="attendee-bio-max-length"
          type="number"
          min={40}
          max={500}
          disabled={disabled || !config.bio}
          className={SETTINGS_FIELD_CLASS}
          value={config.bioMaxLength}
          onChange={(e) =>
            onChange({ ...config, bioMaxLength: Math.min(500, Math.max(40, Number(e.target.value) || 280)) })
          }
        />
      </div>

      <div>
        <label htmlFor="attendee-bio-prompt" className={SETTINGS_LABEL_CLASS}>
          Default bio prompt
        </label>
        <textarea
          id="attendee-bio-prompt"
          disabled={disabled || !config.bio}
          className={cn(SETTINGS_FIELD_CLASS, 'min-h-[72px] resize-y')}
          value={config.bioPrompt ?? ''}
          onChange={(e) => onChange({ ...config, bioPrompt: e.target.value.trim() || null })}
          placeholder="What are you hoping to do at this event?"
        />
      </div>
    </div>
  )
}
