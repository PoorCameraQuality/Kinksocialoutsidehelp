import ReportAction from '@/components/moderation/ReportAction'
import { copyCanonicalLink } from '@c2k/shared'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  path: string
  className?: string
  bookmark?: {
    saved: boolean
    busy?: boolean
    onToggle: () => void
  }
  report?: {
    targetType: string
    targetId: string
    targetLabel?: string
  }
  extraMenuItems?: Array<{
    label: string
    onClick: () => void
    destructive?: boolean
  }>
}

export default function CopyLinkOverflowMenu({ path, className = '', bookmark, report, extraMenuItems }: Props) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // Anchor the portaled menu to the trigger so it escapes any `overflow-hidden`
  // card without being clipped (right-aligned under the button).
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)

  const reposition = useCallback(() => {
    const el = rootRef.current
    const menuEl = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const right = Math.max(8, window.innerWidth - rect.right)
    const gap = 4
    const padding = 8
    let top = rect.bottom + gap
    if (menuEl) {
      const menuHeight = menuEl.getBoundingClientRect().height
      const overflowBelow = top + menuHeight > window.innerHeight - padding
      const spaceAbove = rect.top - gap - padding
      if (overflowBelow && spaceAbove >= menuHeight) {
        top = rect.top - gap - menuHeight
      } else if (overflowBelow) {
        top = Math.max(padding, window.innerHeight - padding - menuHeight)
      }
    }
    setAnchor({ top, right })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null)
      return
    }
    reposition()
    const id = requestAnimationFrame(() => reposition())
    return () => cancelAnimationFrame(id)
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = () => {
    void copyCanonicalLink(path).then((ok) => {
      if (ok) setCopied(true)
      setOpen(false)
    })
  }

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-dc-muted transition-colors hover:bg-dc-elevated-muted hover:text-dc-text"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>
      {open && anchor ?
        createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          style={{ top: anchor.top, right: anchor.right }}
          className="fixed z-dc-dropdown min-w-[10rem] overflow-hidden rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-[var(--dc-shadow-panel)]"
        >
          {bookmark ?
            <button
              type="button"
              role="menuitem"
              disabled={bookmark.busy}
              className="block w-full min-h-11 px-3 py-2 text-left text-sm text-dc-text hover:bg-dc-elevated-muted disabled:opacity-60"
              onClick={() => {
                bookmark.onToggle()
                setOpen(false)
              }}
            >
              {bookmark.saved ? 'Remove bookmark' : 'Save'}
            </button>
          : null}
          {report ?
            <ReportAction
              variant="menu-item"
              targetType={report.targetType}
              targetId={report.targetId}
              targetLabel={report.targetLabel}
              surface="feed"
              className="min-h-11 !px-3 !py-2 text-dc-danger"
              onTrigger={() => setOpen(false)}
            />
          : null}
          {extraMenuItems?.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`block w-full min-h-11 px-3 py-2 text-left text-sm hover:bg-dc-elevated-muted ${
                item.destructive ? 'text-dc-danger' : 'text-dc-text'
              }`}
              onClick={() => {
                item.onClick()
                setOpen(false)
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="block w-full min-h-11 px-3 py-2 text-left text-sm text-dc-text hover:bg-dc-elevated-muted"
            onClick={handleCopy}
          >
            Copy link
          </button>
        </div>,
        document.body,
        )
      : null}
      {copied ?
        <div
          role="status"
          className="absolute right-0 top-full z-dc-dropdown mt-1 whitespace-nowrap rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-1.5 text-xs font-medium text-dc-text shadow-[var(--dc-shadow-panel)]"
        >
          Link copied
        </div>
      : null}
    </div>
  )
}
