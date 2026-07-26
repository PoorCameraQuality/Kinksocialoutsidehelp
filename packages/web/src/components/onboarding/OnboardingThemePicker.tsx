'use client'

import { useDancecardAppearance } from '@/components/dancecard/DancecardAppearanceContext'
import {
  ONBOARDING_APPEARANCE_PRESETS,
  type DancecardAppearanceId,
  type DancecardAppearancePreset,
} from '@/lib/dancecard/appearancePresets'

type ThemePreviewCardProps = {
  preset: DancecardAppearancePreset
  selected: boolean
  onSelect: (id: DancecardAppearanceId) => void
}

function ThemePreviewCard({ preset, selected, onSelect }: ThemePreviewCardProps) {
  const { vars } = preset

  return (
    <button
      type="button"
      onClick={() => onSelect(preset.id)}
      aria-pressed={selected}
      className={`flex min-h-11 flex-col rounded-xl border-2 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface ${
        selected ?
          'border-dc-accent bg-dc-accent-muted/20 shadow-[0_0_0_1px_var(--dc-accent-border)]'
        : 'border-dc-border bg-dc-elevated-solid hover:border-dc-border-strong'
      }`}
    >
      <div
        className="rounded-lg p-2"
        style={{ background: vars['--dc-surface'] }}
        aria-hidden
      >
        <div
          className="overflow-hidden rounded-md border shadow-sm"
          style={{
            borderColor: vars['--dc-border-subtle'],
            background: vars['--dc-elevated-solid'],
            color: vars['--dc-text'],
          }}
        >
        <div className="h-2.5 w-full" style={{ background: vars['--dc-accent'] }} />
        <div className="space-y-1.5 p-2.5">
          <div className="h-2 w-3/5 rounded-sm" style={{ background: vars['--dc-text'] }} />
          <div className="h-1.5 w-full rounded-sm opacity-70" style={{ background: vars['--dc-text-muted'] }} />
          <div className="mt-2 flex gap-1.5">
            <span
              className="rounded px-2 py-0.5 text-[10px] font-medium leading-none"
              style={{
                background: vars['--dc-accent'],
                color: vars['--dc-accent-foreground'] ?? vars['--dc-text'],
              }}
            >
              Join
            </span>
            <span
              className="rounded border px-2 py-0.5 text-[10px] leading-none"
              style={{
                borderColor: vars['--dc-border-subtle'],
                color: vars['--dc-text-muted'],
              }}
            >
              Explore
            </span>
          </div>
        </div>
      </div>
      </div>
      <span className="mt-2.5 text-sm font-semibold text-dc-text">{preset.name}</span>
      <span className="mt-0.5 text-xs leading-snug text-dc-text-muted">{preset.tagline}</span>
    </button>
  )
}

export default function OnboardingThemePicker() {
  const { appearanceId, setAppearanceId } = useDancecardAppearance()

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      role="radiogroup"
      aria-label="Site color theme"
    >
      {ONBOARDING_APPEARANCE_PRESETS.map((preset) => (
        <ThemePreviewCard
          key={preset.id}
          preset={preset}
          selected={appearanceId === preset.id}
          onSelect={setAppearanceId}
        />
      ))}
    </div>
  )
}
