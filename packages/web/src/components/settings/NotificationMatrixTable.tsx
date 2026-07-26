import type { NotificationSettings } from '@c2k/shared'
import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import {
  NOTIFICATION_MATRIX_SECTIONS,
  readMatrixPair,
  writeMatrixPair,
} from '@/components/settings/notificationMatrix'
import { settingsCheckboxClass } from '@/lib/settingsFormClasses'

type MatrixTableProps = {
  notifications: NotificationSettings
  onChange: (next: NotificationSettings) => void
}

function ChannelCell({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <td className="w-16 text-center align-middle">
      {disabled ?
        <span className="text-xs text-dc-muted" aria-label={`${label} not available`}>
          -
        </span>
      : <input
          type="checkbox"
          className={settingsCheckboxClass}
          checked={checked}
          aria-label={label}
          onChange={(e) => onChange(e.target.checked)}
        />
      }
    </td>
  )
}

export function NotificationMatrixTable({ notifications, onChange }: MatrixTableProps) {
  return (
    <div className="space-y-6">
      {NOTIFICATION_MATRIX_SECTIONS.map((section) => (
        <Panel key={section.id}>
          <SectionHeader eyebrow={section.eyebrow} title={section.title} description={section.description} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left">
              <thead>
                <tr className="border-b border-dc-border text-xs uppercase tracking-wide text-dc-muted">
                  <th className="pb-2 pr-4 font-medium">Notification</th>
                  <th className="pb-2 w-16 text-center font-medium">Push</th>
                  <th className="pb-2 w-16 text-center font-medium">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dc-border">
                {section.rows.map((row) => {
                  const pair = readMatrixPair(notifications, row.section, row.field)
                  return (
                    <tr key={row.id}>
                      <td className="py-3 pr-4 align-top">
                        <span className="block text-sm text-dc-text-muted">{row.label}</span>
                        {row.hint ? <span className="mt-0.5 block text-xs text-dc-muted">{row.hint}</span> : null}
                      </td>
                      <ChannelCell
                        checked={pair.push}
                        disabled={row.pushNA}
                        label={`Push: ${row.label}`}
                        onChange={(value) => onChange(writeMatrixPair(notifications, row.section, row.field, 'push', value))}
                      />
                      <ChannelCell
                        checked={pair.email}
                        disabled={row.emailNA}
                        label={`Email: ${row.label}`}
                        onChange={(value) => onChange(writeMatrixPair(notifications, row.section, row.field, 'email', value))}
                      />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </div>
  )
}
