import {
  cardSurfaceInteractiveClass,
  cardSurfacePanelClass,
  cardSurfaceSolidClass,
} from '@/lib/card-surface'
import { cn } from '@/lib/cn'

/**
 * Shared card container — canonical elevated panel surface (matches dancecard Panel).
 */
export default function Card({
  children,
  className = '',
  padding = 'none',
  interactive = false,
}: {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  interactive?: boolean
}) {
  const paddingClass = padding === 'sm' ? 'p-3' : padding === 'md' ? 'p-4' : padding === 'lg' ? 'p-6' : ''
  const surfaceClass = interactive ? cardSurfaceSolidClass : cardSurfacePanelClass
  return (
    <div
      className={cn(
        surfaceClass,
        interactive && cardSurfaceInteractiveClass,
        paddingClass,
        className,
      )}
    >
      {children}
    </div>
  )
}
