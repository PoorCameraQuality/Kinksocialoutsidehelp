import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import {
  profileStudioInsetCardAccentClass,
  profileStudioInsetCardClass,
  profileStudioInsetCardWarningClass,
} from './profile-studio-classes'

type Props = {
  children: ReactNode
  className?: string
  variant?: 'default' | 'accent' | 'warning'
  id?: string
}

const variantClass = {
  default: profileStudioInsetCardClass,
  accent: profileStudioInsetCardAccentClass,
  warning: profileStudioInsetCardWarningClass,
} as const

export default function ProfileStudioInsetCard({
  children,
  className,
  variant = 'default',
  id,
}: Props) {
  return (
    <div id={id} className={cn(variantClass[variant], className)}>
      {children}
    </div>
  )
}
