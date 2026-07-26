import { useEffect, useRef, type ReactNode } from 'react'

const SCROLL_PX_PER_FRAME = 0.45

type AutoScrollRowProps = {
  children: ReactNode
  /** Accessible label for the scrolling region */
  'aria-label': string
  className?: string
  /** Extra classes on the inner scroll track */
  trackClassName?: string
}

export default function AutoScrollRow({
  children,
  'aria-label': ariaLabel,
  className = '',
  trackClassName = '',
}: AutoScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const rafRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const step = () => {
      const node = scrollRef.current
      if (!node) {
        rafRef.current = requestAnimationFrame(step)
        return
      }
      const max = node.scrollWidth - node.clientWidth
      if (max > 0 && !pausedRef.current) {
        node.scrollLeft += SCROLL_PX_PER_FRAME
        if (node.scrollLeft >= max - 0.5) {
          node.scrollLeft = 0
        }
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div
      className={className}
      onMouseEnter={() => {
        pausedRef.current = true
      }}
      onMouseLeave={() => {
        pausedRef.current = false
      }}
      onTouchStart={() => {
        pausedRef.current = true
      }}
      onTouchEnd={() => {
        pausedRef.current = false
      }}
      onFocusCapture={() => {
        pausedRef.current = true
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          pausedRef.current = false
        }
      }}
    >
      <div
        ref={scrollRef}
        role="region"
        aria-label={ariaLabel}
        className={`flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 c2k-no-scrollbar ${trackClassName}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  )
}
