import { cn } from '@/lib/cn'
import { EVENT_CATEGORIES } from '@c2k/shared'
import type { EventsScopeTab } from '@/lib/events-page-utils'

type FormatFilter = 'all' | 'in-person' | 'virtual'

type Chip = {
  id: string
  label: string
  active: boolean
  onClick: () => void
}

type Props = {
  scopeTab: EventsScopeTab
  eventFormatFilter: FormatFilter
  isAuthenticated: boolean
  selectedCategories?: string[]
  onScopeChange: (tab: EventsScopeTab) => void
  onFormatChange: (format: FormatFilter) => void
  onToggleCategory?: (cat: string) => void
  onReset: () => void
  className?: string
}

/** Quick category chips → canonical event categories (kept stable via @c2k/shared). */
const CATEGORY_QUICK_CHIPS: { label: string; category: string }[] = [
  { label: 'Munches', category: EVENT_CATEGORIES.social },
  { label: 'Classes', category: EVENT_CATEGORIES.educational },
  { label: 'Parties', category: EVENT_CATEGORIES.playParty },
  { label: 'Conventions', category: EVENT_CATEGORIES.conferenceFestival },
]

export default function EventsMobileFastFilters({
  scopeTab,
  eventFormatFilter,
  isAuthenticated,
  selectedCategories = [],
  onScopeChange,
  onFormatChange,
  onToggleCategory,
  onReset,
  className,
}: Props) {
  const noCategories = selectedCategories.length === 0
  const chips: Chip[] = [
    {
      id: 'all',
      label: 'All upcoming',
      active: scopeTab === 'all' && eventFormatFilter === 'all' && noCategories,
      onClick: onReset,
    },
    {
      id: 'weekend',
      label: 'This weekend',
      active: scopeTab === 'weekend',
      onClick: () => onScopeChange('weekend'),
    },
    {
      id: 'next7',
      label: 'Next 7 days',
      active: scopeTab === 'next7',
      onClick: () => onScopeChange('next7'),
    },
    {
      id: 'month',
      label: 'This month',
      active: scopeTab === 'month',
      onClick: () => onScopeChange('month'),
    },
    {
      id: 'online',
      label: 'Online',
      active: eventFormatFilter === 'virtual',
      onClick: () => onFormatChange(eventFormatFilter === 'virtual' ? 'all' : 'virtual'),
    },
    {
      id: 'local',
      label: 'In person',
      active: eventFormatFilter === 'in-person',
      onClick: () => onFormatChange(eventFormatFilter === 'in-person' ? 'all' : 'in-person'),
    },
  ]

  if (isAuthenticated) {
    chips.push({
      id: 'for-you',
      label: 'For you',
      active: scopeTab === 'for-you',
      onClick: () => onScopeChange('for-you'),
    })
  }

  if (onToggleCategory) {
    for (const { label, category } of CATEGORY_QUICK_CHIPS) {
      chips.push({
        id: `cat-${category}`,
        label,
        active: selectedCategories.includes(category),
        onClick: () => onToggleCategory(category),
      })
    }
  }

  return (
    <div
      className={cn(
        'mb-3 flex gap-2 overflow-x-auto pb-0.5 c2k-no-scrollbar lg:hidden',
        className,
      )}
      role="toolbar"
      aria-label="Quick event filters"
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={chip.active}
          onClick={chip.onClick}
          className={cn('dc-chip focus-visible:outline-none', chip.active && 'dc-chip--active')}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
