import SelectableChip from './SelectableChip'

export type ChipOption = { id: string; label: string; hint?: string }

export default function ChipGroup({
  options,
  selected,
  onToggle,
  multi = true,
  tone = 'default',
  exclusive,
}: {
  options: readonly ChipOption[]
  selected: string | string[]
  onToggle: (id: string) => void
  multi?: boolean
  tone?: 'default' | 'role' | 'interest' | 'hardNo'
  exclusive?: boolean
}) {
  const isSelected = (id: string) =>
    Array.isArray(selected) ? selected.includes(id) : selected === id

  return (
    <div className="flex flex-wrap gap-2" role={multi && !exclusive ? 'group' : 'radiogroup'}>
      {options.map((o) => (
        <SelectableChip
          key={o.id}
          label={o.label}
          selected={isSelected(o.id)}
          tone={tone}
          onClick={() => onToggle(o.id)}
        />
      ))}
    </div>
  )
}
