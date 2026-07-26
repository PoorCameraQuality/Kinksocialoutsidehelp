type Props = {
  tabs: ReadonlyArray<{ id: string; label: string; count?: number }>
  active: string
  onChange: (id: string) => void
}

export default function GroupsSectionTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto c2k-no-scrollbar" role="tablist">
      {tabs.map(({ id, label, count }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            active === id ?
              'bg-dc-accent text-dc-accent-foreground'
            : 'border border-dc-border text-dc-text-muted hover:text-dc-text'
          }`}
        >
          {label}
          {count != null && count > 0 ? ` ${count}` : ''}
        </button>
      ))}
    </div>
  )
}
