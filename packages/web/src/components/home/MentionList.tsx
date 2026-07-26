import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

export type MentionItem = { type: string; id: string; label: string }

export type MentionListProps = {
  items: MentionItem[]
  command: (item: MentionItem) => void
}

export type MentionListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    setSelected(0)
  }, [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelected((i) => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelected((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = items[selected]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dc-border bg-dc-elevated/95 px-3 py-2 text-xs text-dc-muted shadow-lg">
        No matches
      </div>
    )
  }

  return (
    <div className="max-h-48 min-w-[200px] overflow-y-auto rounded-lg border border-dc-border bg-dc-elevated/95 py-1 shadow-lg">
      {items.map((item, i) => (
        <button
          key={`${item.type}-${item.id}`}
          type="button"
          className={`block w-full px-3 py-2 text-left text-sm text-dc-text hover:bg-dc-elevated-muted ${i === selected ? 'bg-dc-elevated-muted' : ''}`}
          onClick={() => command(item)}
        >
          @{item.label}
        </button>
      ))}
    </div>
  )
})

MentionList.displayName = 'MentionList'

export default MentionList
