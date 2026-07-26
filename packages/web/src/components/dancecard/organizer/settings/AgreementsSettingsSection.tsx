'use client'

import type { AgreementsConfig } from '@/lib/dancecard/agreementsConfig'
import { SETTINGS_FIELD_CLASS, SETTINGS_LABEL_CLASS } from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import { Panel } from '@/components/dancecard/ui/Panel'
import { policyKindLabel } from '@/lib/dancecard/policyKindLabels'

const POLICY_KINDS = ['coc', 'waiver', 'photo', 'marketing'] as const

export function AgreementsSettingsSection({
  config,
  onConfigChange,
  disabled,
}: {
  config: AgreementsConfig
  onConfigChange: (next: AgreementsConfig) => void
  disabled?: boolean
}) {
  const required = new Set(config.requiredPolicyKinds ?? [])

  return (
    <Panel className="space-y-3">
      <label className={SETTINGS_LABEL_CLASS}>
        How attendees sign
        <select
          className={`${SETTINGS_FIELD_CLASS} mt-1.5`}
          disabled={disabled}
          value={config.mode ?? 'ecke'}
          onChange={(e) => onConfigChange({ ...config, mode: e.target.value as AgreementsConfig['mode'] })}
        >
          <option value="ecke">ECKE Sign (built-in on dancecard)</option>
          <option value="rabbitsign">RabbitSign only</option>
          <option value="hybrid">Hybrid (ECKE Sign + RabbitSign)</option>
        </select>
      </label>
      <p className="text-xs text-dc-muted">
        ECKE Sign uses your published policy documents. RabbitSign sync requires API setup under Integrations.
      </p>
      <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Required before check-in</p>
      <div className="flex flex-wrap gap-2">
        {POLICY_KINDS.map((kind) => (
          <label key={kind} className="flex items-center gap-2 rounded-lg border border-dc-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={required.has(kind)}
              onChange={(e) => {
                const next = new Set(required)
                if (e.target.checked) next.add(kind)
                else next.delete(kind)
                onConfigChange({ ...config, requiredPolicyKinds: Array.from(next) })
              }}
            />
            {policyKindLabel(kind)}
          </label>
        ))}
      </div>
      <label className={SETTINGS_LABEL_CLASS}>
        Agreement deadline (optional)
        <input
          type="datetime-local"
          className={SETTINGS_FIELD_CLASS}
          disabled={disabled}
          value={config.deadlineAt ? new Date(config.deadlineAt).toISOString().slice(0, 16) : ''}
          onChange={(e) =>
            onConfigChange({
              ...config,
              deadlineAt: e.target.value ? new Date(e.target.value).toISOString() : null,
            })
          }
        />
      </label>
    </Panel>
  )
}
