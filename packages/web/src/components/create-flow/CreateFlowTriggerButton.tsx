import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { OpenCreateFlowOptions } from '@/lib/open-create-flow'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  flow: OpenCreateFlowOptions
  children: ReactNode
}

/** Opens the global create-event wizard without leaving the current page. */
export default function CreateFlowTriggerButton({ flow, children, className, onClick, ...rest }: Props) {
  return (
    <button
      type="button"
      data-create-trigger
      data-create-flow={flow.type}
      data-prefill-org-id={flow.prefillOrgId}
      data-prefill-group-id={flow.prefillGroupId}
      data-kind={flow.kind}
      className={cn(className)}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  )
}
