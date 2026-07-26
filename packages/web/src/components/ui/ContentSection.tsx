import type { ElementType, ReactNode } from 'react'
import { cardSurfaceBaseClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'

type Padding = 'none' | 'sm' | 'md' | 'lg' | 'sidebar'

const paddingClasses: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  sidebar: 'p-5 sm:p-6',
}

type Props<T extends ElementType = 'div'> = {
  children: ReactNode
  className?: string
  padding?: Padding
  as?: T
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'padding'>

/**
 * Opaque base content shell — replaces copy-pasted `bg-dc-elevated/95 rounded-2xl border …`.
 * See docs/UI_SURFACE_SYSTEM.md · surface ladder · base.
 */
export default function ContentSection<T extends ElementType = 'div'>({
  children,
  className,
  padding = 'md',
  as,
  ...rest
}: Props<T>) {
  const Component = as ?? 'div'
  return (
    <Component className={cn(cardSurfaceBaseClass, paddingClasses[padding], className)} {...rest}>
      {children}
    </Component>
  )
}
