import type { ReactNode } from 'react'
import GeoFilterControl, { type GeoFilterControlProps } from '@/components/browse/GeoFilterControl'

type Props = GeoFilterControlProps & {
  title?: string
  children?: ReactNode
  className?: string
}

/** Left-rail browse filters with shared geo control (SG-134). */
export default function BrowseFilterSidebar({
  title = 'Location',
  children,
  className = '',
  ...geoProps
}: Props) {
  return (
    <aside className={`space-y-6 ${className}`.trim()} aria-label="Browse filters">
      <div>
        <h2 className="text-sm font-semibold text-dc-text mb-3">{title}</h2>
        <GeoFilterControl {...geoProps} />
      </div>
      {children}
    </aside>
  )
}
