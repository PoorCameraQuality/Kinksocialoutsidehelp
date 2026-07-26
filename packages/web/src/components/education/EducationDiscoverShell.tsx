import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

/** Education discover uses its own left rail - no duplicate Explore sub-nav. */
export default function EducationDiscoverShell({ children }: Props) {
  return <div className="education-hub min-w-0">{children}</div>
}
