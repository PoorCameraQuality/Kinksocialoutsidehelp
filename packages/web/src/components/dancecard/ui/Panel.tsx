import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

import { cardSurfaceBaseClass, cardSurfacePanelClass, surfaceNestedClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'

type PanelVariant = 'default' | 'muted' | 'inset'

const variantClass: Record<PanelVariant, string> = {
  default: cn(cardSurfaceBaseClass, 'dc-card-polish ring-1 ring-inset ring-white/[0.06]'),
  muted: cn(cardSurfacePanelClass, 'dc-card-polish ring-1 ring-inset ring-white/[0.04]'),
  inset: cn(surfaceNestedClass, 'shadow-none'),
}

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: PanelVariant
  children: ReactNode
}

export const Panel = forwardRef<HTMLDivElement, Props>(function Panel(
  { variant = 'default', className = '', children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('rounded-2xl p-6 sm:p-7', variantClass[variant], className)}
      {...rest}
    >
      {children}
    </div>
  )
})
