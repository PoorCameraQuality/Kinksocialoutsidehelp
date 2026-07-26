import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean
  children: ReactNode
}

export function PillTab({ selected = false, className = '', children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={`min-h-touch rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface ${
        selected
          ? 'border-dc-accent-border bg-dc-accent-muted text-dc-accent'
          : 'border-dc-border bg-transparent text-dc-muted hover:border-dc-border-strong hover:text-dc-text'
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}

export function handlePillTabListKeyDown(
  event: KeyboardEvent<HTMLElement>,
  ids: string[],
  activeId: string,
  onSelect: (id: string) => void,
) {
  const idx = ids.indexOf(activeId)
  if (idx < 0) return
  let next = idx
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next = (idx + 1) % ids.length
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next = (idx - 1 + ids.length) % ids.length
  } else if (event.key === 'Home') {
    next = 0
  } else if (event.key === 'End') {
    next = ids.length - 1
  } else {
    return
  }
  event.preventDefault()
  onSelect(ids[next]!)
}
