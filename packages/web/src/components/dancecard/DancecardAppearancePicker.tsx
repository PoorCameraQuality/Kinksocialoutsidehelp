'use client'

import { useDancecardAppearance } from '@/components/dancecard/DancecardAppearanceContext'
import type { DancecardAppearanceId } from '@/lib/dancecard/appearancePresets'

type Props = {
  className?: string
  compact?: boolean
}

export default function DancecardAppearancePicker({ className = '', compact = false }: Props) {
  const { appearanceId, presets, setAppearanceId } = useDancecardAppearance()

  return (
    <label
      className={`flex min-w-0 items-center gap-2 text-sm text-dc-text ${className}`.trim()}
      title="Site appearance. Saved on this device"
    >
      {!compact ? (
        <span className="shrink-0 text-dc-micro uppercase tracking-wide text-dc-muted">Theme</span>
      ) : null}
      <select
        className="min-w-0 max-w-full truncate rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text shadow-[var(--dc-shadow-soft)]"
        value={appearanceId}
        onChange={(e) => setAppearanceId(e.target.value as DancecardAppearanceId)}
        aria-label="Site appearance theme"
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export { DancecardAppearancePicker }
