type Tone = 'default' | 'role' | 'interest' | 'hardNo'

const radius: Record<Tone, string> = {
  default: 'rounded-xl',
  role: 'rounded-full',
  interest: 'rounded-xl',
  hardNo: 'rounded-lg',
}

export default function SelectableChip({
  label,
  selected,
  onClick,
  tone = 'default',
  disabled,
}: {
  label: string
  selected: boolean
  onClick: () => void
  tone?: Tone
  disabled?: boolean
}) {
  const hard = tone === 'hardNo'
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'inline-flex min-h-11 items-center gap-1.5 border px-3.5 text-[14px] font-medium transition-[background-color,border-color,transform] duration-125',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dc-elevated)]',
        'active:scale-[0.98] disabled:opacity-50',
        radius[tone],
        selected
          ? hard
            ? 'border-[var(--dc-danger-border)] bg-[color-mix(in_srgb,var(--dc-danger)_14%,var(--dc-elevated))] font-semibold text-dc-text'
            : 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] font-semibold text-dc-text'
          : 'border-dc-border bg-dc-elevated-muted text-dc-text-muted hover:bg-dc-elevated-hover',
      ].join(' ')}
    >
      {selected ? (
        <span aria-hidden className={hard ? 'text-[var(--dc-danger)]' : 'text-[var(--dc-accent)]'}>
          {hard ? '×' : '✓'}
        </span>
      ) : null}
      {label}
    </button>
  )
}
