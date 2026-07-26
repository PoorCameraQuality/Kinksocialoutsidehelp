import type { PrivacySettings } from '@c2k/shared'

type PresetId = PrivacySettings['whoCanMessage']

const PRESETS: {
  id: PresetId
  title: string
  tagline: string
  rows: { label: string; status: 'inbox' | 'request' | 'blocked' }[]
}[] = [
  {
    id: 'open',
    title: 'Open',
    tagline: 'Anyone signed in can start a conversation with you.',
    rows: [
      { label: 'Connections', status: 'inbox' },
      { label: 'Shared group members', status: 'inbox' },
      { label: 'Everyone else', status: 'request' },
    ],
  },
  {
    id: 'connections_only',
    title: 'Community',
    tagline: 'Good default for most members.',
    rows: [
      { label: 'Connections', status: 'inbox' },
      { label: 'Shared group members', status: 'blocked' },
      { label: 'Everyone else', status: 'blocked' },
    ],
  },
  {
    id: 'friends',
    title: 'Close circle',
    tagline: 'Only connections can start a conversation with you.',
    rows: [
      { label: 'Connections', status: 'inbox' },
      { label: 'Shared group members', status: 'blocked' },
      { label: 'Everyone else', status: 'blocked' },
    ],
  },
]

function StatusIcon({ status }: { status: 'inbox' | 'request' | 'blocked' }) {
  if (status === 'inbox') {
    return <span className="text-emerald-400" aria-hidden>✓</span>
  }
  if (status === 'request') {
    return <span className="text-amber-400" aria-hidden>✋</span>
  }
  return <span className="text-red-400" aria-hidden>✕</span>
}

type Props = {
  active: PresetId
  onSelect: (preset: PresetId) => void
}

export default function SettingsMessagingPresets({ active, onSelect }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PRESETS.map((preset) => {
        const isActive = active === preset.id
        return (
          <div
            key={preset.id}
            className={`rounded-xl border p-4 flex flex-col ${
              isActive ? 'border-dc-accent bg-dc-accent/10' : 'border-dc-border bg-dc-elevated/40'
            }`}
          >
            <h3 className="text-sm font-semibold text-dc-text">{preset.title}</h3>
            <p className="mt-1 text-xs text-dc-muted">{preset.tagline}</p>
            <ul className="mt-3 space-y-1.5 text-xs text-dc-text-muted flex-1">
              {preset.rows.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-2">
                  <span>{row.label}</span>
                  <span className="inline-flex items-center gap-1">
                    <StatusIcon status={row.status} />
                    <span className="sr-only">
                      {row.status === 'inbox' ? 'Inbox' : row.status === 'request' ? 'Message request' : 'Cannot send'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={isActive}
              onClick={() => onSelect(preset.id)}
              className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ?
                  'bg-dc-accent text-dc-accent-foreground cursor-default'
                : 'border border-dc-border text-dc-text hover:bg-dc-elevated-muted'
              }`}
            >
              {isActive ? 'Active' : 'Activate'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
