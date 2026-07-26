import type { ReactNode } from 'react'

/** Cross-fade tab/panel swaps; pair with `dc-tab-content-enter` in dancecard-motion.css. */
export function TabContentTransition({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  return (
    <div key={tabKey} className="dc-tab-content-enter">
      {children}
    </div>
  )
}
