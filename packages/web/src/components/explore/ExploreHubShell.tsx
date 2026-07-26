import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

/** Explore dashboard scoped styles live under `.explore-hub`. */
export default function ExploreHubShell({ children }: Props) {
  return <div className="explore-hub min-w-0">{children}</div>
}
