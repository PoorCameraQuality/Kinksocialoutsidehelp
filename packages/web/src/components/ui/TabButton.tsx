interface TabButtonProps {
  label: string
  isActive: boolean
  onClick: () => void
  size?: 'default' | 'small'
  className?: string
  /**
   * `tab` - use inside a `role="tablist"` (sets `role="tab"` + `aria-selected`).
   * `toggle` - standalone filter chips (`aria-pressed`).
   */
  ariaStyle?: 'tab' | 'toggle'
}

export default function TabButton({
  label,
  isActive,
  onClick,
  size = 'default',
  className = '',
  ariaStyle = 'tab',
}: TabButtonProps) {
  const sizeClasses =
    size === 'small' ? 'px-3 py-2 text-xs min-h-11' : 'px-4 py-2 text-sm min-h-11'

  const aria =
    ariaStyle === 'tab'
      ? { role: 'tab' as const, 'aria-selected': isActive }
      : { 'aria-pressed': isActive as boolean }

  return (
    <button
      type="button"
      onClick={onClick}
      {...aria}
      className={`flex-shrink-0 rounded-xl font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface ${sizeClasses} ${
        isActive ?
          'bg-dc-accent text-dc-accent-foreground shadow-[var(--dc-tab-active-shadow)]'
        : 'bg-transparent text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
      } ${className}`}
    >
      {label}
    </button>
  )
}
