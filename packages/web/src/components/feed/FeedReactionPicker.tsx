import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMaxMd } from '@/hooks/useMaxMd'
import { FEED_REACTION_OPTIONS } from '@/lib/feed-reaction-ui'
import { cn } from '@/lib/cn'
import type { FeedReactionId } from '@c2k/shared'

type Props = {
  open: boolean
  onClose: () => void
  anchorEl: HTMLElement | null
  viewerReaction: FeedReactionId | null
  busy?: boolean
  onSelect: (kind: FeedReactionId) => void
}

export default function FeedReactionPicker({
  open,
  onClose,
  anchorEl,
  viewerReaction,
  busy,
  onSelect,
}: Props) {
  const menuId = useId()
  const isMobile = useMaxMd()
  const menuRef = useRef<HTMLDivElement>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; above: boolean } | null>(null)

  const reposition = useCallback(() => {
    if (!anchorEl || isMobile) return
    const rect = anchorEl.getBoundingClientRect()
    const gap = 8
    const menuHeight = 220
    const spaceAbove = rect.top
    const above = spaceAbove >= menuHeight + gap || spaceAbove > window.innerHeight - rect.bottom
    setPopoverPos({
      top: above ? rect.top - gap : rect.bottom + gap,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - 248),
      above,
    })
  }, [anchorEl, isMobile])

  useLayoutEffect(() => {
    if (!open || isMobile) {
      setPopoverPos(null)
      return
    }
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, isMobile, reposition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorEl?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, anchorEl, onClose])

  if (!open) return null

  const options = (
    <>
      {FEED_REACTION_OPTIONS.map(({ id, label, title, hint, Icon }) => {
        const active = viewerReaction === id
        return (
          <button
            key={id}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            disabled={busy}
            className={cn(
              'feed-reaction-picker__option',
              active && 'feed-reaction-picker__option--active',
            )}
            onClick={() => {
              onSelect(id)
              onClose()
            }}
          >
            <span className="feed-reaction-picker__option-icon" aria-hidden>
              <Icon className="h-5 w-5" />
            </span>
            <span className="feed-reaction-picker__option-text">
              <span className="feed-reaction-picker__option-label">{label}</span>
              <span className="feed-reaction-picker__option-hint">{title} — {hint}</span>
            </span>
            {active ?
              <span className="feed-reaction-picker__option-check" aria-hidden>
                ✓
              </span>
            : null}
          </button>
        )
      })}
    </>
  )

  if (isMobile) {
    return createPortal(
      <div
        className="fixed inset-0 z-dc-modal flex flex-col justify-end"
        role="presentation"
      >
        <button
          type="button"
          className="min-h-0 flex-1 bg-black/45"
          aria-label="Close reaction picker"
          onClick={onClose}
        />
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Choose a reaction"
          className="feed-reaction-picker__sheet dc-sheet-enter safe-area-pb rounded-t-2xl border border-dc-border bg-dc-elevated-solid pb-[calc(var(--c2k-bottom-nav-total-h,0px)+0.75rem)] shadow-[var(--dc-shadow-panel)]"
        >
          <div className="feed-reaction-picker__sheet-head">
            <h3 className="text-base font-semibold text-dc-text">How do you want to respond?</h3>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg text-dc-muted hover:bg-dc-elevated-muted hover:text-dc-text"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="feed-reaction-picker__sheet-options">{options}</div>
        </div>
      </div>,
      document.body,
    )
  }

  if (!popoverPos) return null

  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Choose a reaction"
      style={{
        top: popoverPos.top,
        left: popoverPos.left,
        transform: popoverPos.above ? 'translateY(-100%)' : undefined,
      }}
      className="feed-reaction-picker__popover fixed z-dc-dropdown w-[min(100vw-1rem,15.5rem)] overflow-hidden rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-[var(--dc-shadow-panel)]"
    >
      {options}
    </div>,
    document.body,
  )
}
