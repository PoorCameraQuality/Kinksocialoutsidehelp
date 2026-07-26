import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

export default function OrganizerFormSection({ title, description, children }: Props) {
  return (
    <div className="space-y-3 border-b border-dc-border pb-5 last:border-0 last:pb-0">
      <div>
        <h3 className="text-sm font-medium text-dc-text">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-dc-muted">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
