type Chip = {
  id: string
  label: string
  active: boolean
}

type Props = {
  chips: Chip[]
  onToggle: (id: string) => void
  ariaLabel: string
  variant?: 'discovery' | 'topic'
}

export default function ExploreChipRow({ chips, onToggle, ariaLabel, variant = 'discovery' }: Props) {
  const wrap = variant === 'discovery'

  return (
    <div className={wrap ? 'min-w-0' : 'relative min-w-0'}>
      <div
        className={
          wrap ?
            'flex flex-wrap gap-1.5'
          : 'flex gap-1.5 overflow-x-auto pb-0.5 c2k-no-scrollbar'
        }
        role="group"
        aria-label={ariaLabel}
      >
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={chip.active}
            className={`xpl-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent ${
              variant === 'discovery' ? 'xpl-chip--discovery' : 'xpl-chip--topic'
            } ${chip.active ? 'xpl-chip--active' : ''}`}
            onClick={() => onToggle(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {!wrap ?
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0.5 w-6 bg-gradient-to-l from-dc-surface to-transparent sm:w-8"
          aria-hidden
        />
      : null}
    </div>
  )
}
