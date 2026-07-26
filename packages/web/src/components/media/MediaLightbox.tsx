import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type MediaLightboxItem = {
  id: string
  url: string
  caption?: string | null
  alt?: string
}

type Props = {
  items: MediaLightboxItem[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
  ariaLabel?: string
}

function navButtonClass(side: 'left' | 'right') {
  return [
    'fixed top-1/2 z-[102] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full',
    'border border-white/20 bg-black/50 text-white shadow-lg backdrop-blur-sm',
    'transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent',
    side === 'left' ? 'left-3 sm:left-6' : 'right-3 sm:right-6',
  ].join(' ')
}

export default function MediaLightbox({
  items,
  index,
  onClose,
  onIndexChange,
  ariaLabel = 'Photo viewer',
}: Props) {
  const [mounted, setMounted] = useState(false)
  const item = items[index]
  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(index - 1)
  }, [hasPrev, index, onIndexChange])

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(index + 1)
  }, [hasNext, index, onIndexChange])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext])

  if (!item || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-dc-modal flex items-center justify-center p-4 sm:p-8"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/90"
        aria-label="Close photo viewer"
        onClick={onClose}
      />

      <div
        className="relative z-[101] flex w-full max-w-6xl flex-col items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="fixed right-4 top-4 z-[102] min-h-10 rounded-lg px-3 text-sm font-medium text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent sm:right-6 sm:top-6"
        >
          Close
        </button>

        {hasPrev ?
          <button type="button" onClick={goPrev} className={navButtonClass('left')} aria-label="Previous photo">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        : null}

        {hasNext ?
          <button type="button" onClick={goNext} className={navButtonClass('right')} aria-label="Next photo">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        : null}

        <img
          src={item.url}
          alt={item.alt ?? item.caption ?? 'Photo'}
          className="max-h-[min(82dvh,900px)] w-auto max-w-full object-contain rounded-lg"
        />

        <div className="mt-4 flex w-full max-w-2xl flex-col items-center gap-1 px-12 text-center">
          {items.length > 1 ?
            <p className="text-xs text-white/60">
              {index + 1} of {items.length}
            </p>
          : null}
          {item.caption ?
            <p className="text-sm text-white/90">{item.caption}</p>
          : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
