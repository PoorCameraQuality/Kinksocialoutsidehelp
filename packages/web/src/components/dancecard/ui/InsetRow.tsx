import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export function InsetRow({ className = '', children, ...rest }: Props) {
  return (
    <div
      className={`flex min-h-touch items-center gap-3 rounded-xl border border-dc-border/80 bg-dc-surface-muted/60 px-3 py-2 text-sm text-dc-text ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  )
}
