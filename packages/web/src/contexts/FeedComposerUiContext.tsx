import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Api = {
  engaged: boolean
  acquire: () => () => void
}

const FeedComposerUiContext = createContext<Api | null>(null)

/** Tracks when a home feed status composer is open or focused (hides mobile Create FAB). */
export function FeedComposerUiProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  const acquire = useCallback(() => {
    setCount((c) => c + 1)
    return () => setCount((c) => Math.max(0, c - 1))
  }, [])
  const value = useMemo(() => ({ engaged: count > 0, acquire }), [count, acquire])
  return <FeedComposerUiContext.Provider value={value}>{children}</FeedComposerUiContext.Provider>
}

export function useFeedComposerEngaged(): boolean {
  return useContext(FeedComposerUiContext)?.engaged ?? false
}

/** Register composer engagement while `active` is true (ref-counted for nested composers). */
export function useFeedComposerEngagement(active: boolean): void {
  const ctx = useContext(FeedComposerUiContext)
  useEffect(() => {
    if (!ctx || !active) return
    return ctx.acquire()
  }, [active, ctx])
}
