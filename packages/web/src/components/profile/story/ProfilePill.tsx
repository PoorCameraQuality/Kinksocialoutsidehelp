import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'



type Props = {

  children: ReactNode

  variant?: 'accent' | 'muted'

  icon?: ReactNode

  className?: string

}



export default function ProfilePill({ children, variant = 'accent', icon, className }: Props) {

  return (

    <span

      className={cn(

        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm',

        variant === 'accent' ?

          'bg-dc-accent/[0.1] text-dc-text ring-1 ring-inset ring-dc-accent/20'

        : 'bg-white/[0.04] text-dc-text-muted ring-1 ring-inset ring-white/[0.06]',

        className,

      )}

    >

      {icon}

      {children}

    </span>

  )

}


