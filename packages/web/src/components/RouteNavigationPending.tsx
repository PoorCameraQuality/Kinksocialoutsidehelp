import { useNavigation } from 'react-router-dom'

/** Thin top bar while a route transition is in flight (UI_UX follow-up C1). */
export default function RouteNavigationPending() {
  const navigation = useNavigation()
  const pending = navigation.state === 'loading'

  if (!pending) return null

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 z-[45] h-0.5 overflow-hidden bg-dc-border-subtle"
      style={{ top: 'var(--c2k-sticky-below-header)' }}
      role="progressbar"
      aria-label="Loading page"
    >
      <div className="h-full w-1/3 animate-[c2k-route-pending_0.9s_ease-in-out_infinite] bg-dc-accent" />
    </div>
  )
}
