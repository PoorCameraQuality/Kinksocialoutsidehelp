import { cn } from '@/lib/cn'

export type ProfileMainNavId = 'overview' | 'photos' | 'posts' | 'connections' | 'more'

const TABS: { id: ProfileMainNavId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'photos', label: 'Photos' },
  { id: 'posts', label: 'Posts' },
  { id: 'connections', label: 'Connections' },
  { id: 'more', label: 'More' },
]

type Props = {
  active: ProfileMainNavId
  onSelect: (id: ProfileMainNavId) => void
  className?: string
}

/**
 * Primary public-profile navigation placed directly under the gallery preview.
 */
export default function ProfileMainNav({ active, onSelect, className }: Props) {
  return (
    <nav
      className={cn(
        'border-b border-dc-border-subtle',
        className,
      )}
      aria-label="Profile sections"
    >
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.id)}
              className={cn(
                'min-h-11 shrink-0 border-b-2 px-3.5 text-sm font-medium transition-colors',
                isActive ?
                  'border-dc-accent text-dc-text'
                : 'border-transparent text-dc-text-muted hover:text-dc-text',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
