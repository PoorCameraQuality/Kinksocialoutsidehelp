import type { MyPostsTab } from '@/components/my-posts/my-posts-ui'
import { MY_POSTS_TABS } from '@/components/my-posts/my-posts-ui'

type Props = {
  active: MyPostsTab
  counts: Partial<Record<MyPostsTab, number>>
  onChange: (tab: MyPostsTab) => void
}

export default function MyPostsTabs({ active, counts, onChange }: Props) {
  return (
    <div
      className="sticky z-10 -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-dc-border bg-dc-surface-muted/95 px-4 backdrop-blur-sm c2k-no-scrollbar sm:static sm:mx-0 sm:bg-transparent sm:backdrop-blur-none"
      style={{ top: 'var(--c2k-sticky-below-header)' }}
      role="tablist"
      aria-label="My posts sections"
    >
      {MY_POSTS_TABS.map((tab) => {
        const selected = active === tab.id
        const count = counts[tab.id]
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors sm:min-h-10 ${
              selected ?
                'border-b-2 border-dc-accent text-dc-accent'
              : 'text-dc-text-muted hover:text-dc-text'
            }`}
          >
            {tab.label}
            {count != null && count > 0 ?
              <span className={selected ? 'text-dc-accent' : 'text-dc-muted'}> {count}</span>
            : null}
          </button>
        )
      })}
    </div>
  )
}
