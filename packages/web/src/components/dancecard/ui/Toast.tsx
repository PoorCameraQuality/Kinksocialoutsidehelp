import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type DancecardToastItem = {
  id: string
  message: string
  undoLabel?: string
  onUndo?: () => void
}

type ToastContextValue = {
  push: (message: string, options?: { undoLabel?: string; onUndo?: () => void }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function DancecardToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<DancecardToastItem[]>([])

  const push = useCallback((message: string, options?: { undoLabel?: string; onUndo?: () => void }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const item: DancecardToastItem = { id, message, undoLabel: options?.undoLabel, onUndo: options?.onUndo }
    setItems((prev) => [...prev, item])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, options?.onUndo ? 8000 : 5000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed left-0 right-0 z-dc-toast flex flex-col items-center gap-2 px-4 c2k-toast-above-bottom-nav"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md flex-wrap items-center gap-2 rounded-xl border border-dc-accent-border bg-dc-elevated/95 px-4 py-3 text-sm text-dc-text shadow-lg backdrop-blur-sm"
          >
            <span>{t.message}</span>
            {t.undoLabel && t.onUndo ? (
              <button
                type="button"
                className="rounded-full border border-dc-accent-border px-2.5 py-0.5 text-xs font-semibold text-dc-accent hover:bg-dc-accent-muted"
                onClick={() => {
                  t.onUndo?.()
                  dismiss(t.id)
                }}
              >
                {t.undoLabel}
              </button>
            ) : null}
            <button
              type="button"
              className="ml-auto text-xs text-dc-muted hover:text-dc-text"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useDancecardToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useDancecardToast must be used within DancecardToastProvider')
  return ctx
}

export const OrganizerToastProvider = DancecardToastProvider
export const useOrganizerToast = useDancecardToast
export type OrganizerToastItem = DancecardToastItem
