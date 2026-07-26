import {
  HubTabsPreviewCard,
  SettingsSection,
  SettingsSubsectionHeader,
} from '@/components/organizer/settings/settings-ui'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { buildHubTabPreview, FEATURE_DEFINITIONS } from '@/lib/organizer/org-settings-utils'
import type { OrgFlags } from '@/components/org/OrgAdminDashboard'

type Props = {
  flags: OrgFlags
  hasFaq: boolean
  hasDocumentsModule: boolean
  onPatchFlags: (next: Partial<OrgFlags>) => void
}

export default function SettingsFeaturesTab({ flags, hasFaq, hasDocumentsModule, onPatchFlags }: Props) {
  const tabs = buildHubTabPreview(flags, hasFaq, hasDocumentsModule)

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
      <SettingsSection>
        <SettingsSubsectionHeader
          title="Public hub features"
          subtitle="Choose which tabs and tools appear on the public organization hub."
        />
        <p className="mb-5 text-sm text-dc-text-muted">
          Turning a feature off hides its tab and related UI from the public hub. Existing data stays saved.
        </p>
        <ul className="space-y-3">
          {FEATURE_DEFINITIONS.map((f) => {
            const enabled = Boolean(flags[f.key])
            return (
              <li
                key={f.key}
                className={cn(
                  'rounded-xl border px-4 py-4',
                  enabled ? 'border-dc-accent/25 bg-dc-accent/5' : 'border-dc-border bg-dc-surface/25',
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-dc-text">{f.name}</p>
                      <Badge variant={enabled ? 'success' : 'neutral'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-dc-text-muted">{f.description}</p>
                    <p className="mt-1 text-xs text-dc-muted">Appears on: {f.appears}</p>
                    {f.warning ?
                      <p className="mt-2 text-xs text-amber-200/80">{f.warning}</p>
                    : null}
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-dc-text">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => onPatchFlags({ [f.key]: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className="sr-only sm:not-sr-only">{enabled ? 'On' : 'Off'}</span>
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
      </SettingsSection>

      <aside>
        <HubTabsPreviewCard tabs={tabs} />
      </aside>
    </div>
  )
}
