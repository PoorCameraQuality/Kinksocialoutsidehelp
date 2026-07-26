'use client'

import { useState } from 'react'
import type { DancecardThemeConfig } from '@/lib/dancecard/theme'
import { Panel } from '@/components/dancecard/ui/Panel'
import { Button } from '@/components/dancecard/ui/Button'
import {
  SETTINGS_FIELD_CLASS,
  SETTINGS_LABEL_CLASS,
} from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'

const THEME_FIELDS: { key: keyof DancecardThemeConfig; label: string }[] = [
  { key: 'accent', label: 'Accent' },
  { key: 'surface', label: 'Surface' },
  { key: 'elevated', label: 'Elevated' },
  { key: 'slotPublished', label: 'Published slot' },
]

export function EventSettingsAdvancedForm({
  event,
  setEvent,
  canEdit,
  canOwnerSettings,
  badgeLayoutDraft,
  setBadgeLayoutDraft,
  onSave,
  onMessage,
  saving,
}: {
  event: EventSettingsEventDto
  setEvent: React.Dispatch<React.SetStateAction<EventSettingsEventDto | null>>
  canEdit: boolean
  canOwnerSettings: boolean
  badgeLayoutDraft: string
  setBadgeLayoutDraft: (v: string) => void
  onSave: (patch: Partial<EventSettingsEventDto>) => Promise<void>
  onMessage: (msg: string | null) => void
  saving: boolean
}) {
  const [themeOpen, setThemeOpen] = useState(false)
  const [badgeOpen, setBadgeOpen] = useState(false)

  return (
    <div className="space-y-4">
      <Panel>
        <h3 className="text-sm font-semibold text-dc-text">Access codes</h3>
        <p className="mt-1 text-xs text-dc-muted">Leave blank to leave registration or staff areas open.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={SETTINGS_LABEL_CLASS}>
            Registration gate
            <input
              className={SETTINGS_FIELD_CLASS}
              value={event.registrationAccessCode}
              disabled={!canOwnerSettings}
              onChange={(e) => setEvent((ev) => (ev ? { ...ev, registrationAccessCode: e.target.value } : ev))}
              onBlur={() => void onSave({ registrationAccessCode: event.registrationAccessCode })}
            />
          </label>
          <label className={SETTINGS_LABEL_CLASS}>
            Staff / volunteer unlock
            <input
              className={SETTINGS_FIELD_CLASS}
              value={event.staffAccessCode}
              disabled={!canOwnerSettings}
              onChange={(e) => setEvent((ev) => (ev ? { ...ev, staffAccessCode: e.target.value } : ev))}
              onBlur={() => void onSave({ staffAccessCode: event.staffAccessCode })}
            />
          </label>
        </div>
      </Panel>

      <Panel variant="muted">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-dc-text"
          onClick={() => setThemeOpen((o) => !o)}
        >
          Event theme colors
          <span className="text-dc-muted">{themeOpen ? 'Hide' : 'Show'}</span>
        </button>
        {themeOpen ? (
          <>
            <p className="mt-2 text-xs text-dc-muted">Overrides accent and surfaces on the public dancecard and embeds.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {THEME_FIELDS.map(({ key, label }) => {
                const value = (event.themeConfig?.[key] as string | undefined) ?? ''
                return (
                  <label key={key} className={SETTINGS_LABEL_CLASS}>
                    {label}
                    <input
                      type="text"
                      className={`${SETTINGS_FIELD_CLASS} font-mono`}
                      placeholder="#c6a75e"
                      value={value}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setEvent((ev) =>
                          ev
                            ? {
                                ...ev,
                                themeConfig: { ...ev.themeConfig, [key]: e.target.value || undefined },
                              }
                            : ev,
                        )
                      }
                      onBlur={() => void onSave({ themeConfig: event.themeConfig ?? {} })}
                    />
                  </label>
                )
              })}
            </div>
            <section
              className="mt-4 flex h-14 items-center justify-center rounded-xl border border-dc-border"
              style={{
                background: event.themeConfig?.surface ?? 'var(--dc-surface)',
                color: event.themeConfig?.accent ?? 'var(--dc-accent)',
              }}
            >
              <span className="text-sm font-semibold">Preview</span>
            </section>
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              disabled={!canEdit || saving}
              onClick={() => void onSave({ themeConfig: event.themeConfig ?? {} })}
            >
              Save theme
            </Button>
          </>
        ) : null}
      </Panel>

      <Panel variant="muted">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-dc-text"
          onClick={() => setBadgeOpen((o) => !o)}
        >
          Badge print layout (JSON)
          <span className="text-dc-muted">{badgeOpen ? 'Hide' : 'Show'}</span>
        </button>
        {badgeOpen ? (
          <>
            <p className="mt-2 text-xs text-dc-muted">For onsite badge printing. Most events can skip this until check-in day.</p>
            <textarea
              aria-label="Badge print layout JSON"
              className={`${SETTINGS_FIELD_CLASS} mt-3 min-h-[120px] font-mono text-xs`}
              disabled={!canEdit}
              value={badgeLayoutDraft}
              onChange={(e) => setBadgeLayoutDraft(e.target.value)}
              onBlur={() => {
                try {
                  const parsed = JSON.parse(badgeLayoutDraft) as Record<string, unknown>
                  void onSave({ badgeLayoutJson: parsed })
                } catch {
                  onMessage('Badge layout JSON is invalid.')
                }
              }}
            />
          </>
        ) : null}
      </Panel>
    </div>
  )
}
