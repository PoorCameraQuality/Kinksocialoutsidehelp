import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  label: string
  value: ReactNode
  action?: ReactNode
  hint?: ReactNode
  valueClassName?: string
}

export default function SettingsAccountRow({ label, value, action, hint, valueClassName }: Props) {
  return (
    <div className="flex flex-col gap-2 border-b border-dc-border py-4 first:pt-0 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-dc-text-muted">{label}</p>
        <div className={`mt-1 text-sm text-dc-text ${valueClassName ?? ''}`}>{value}</div>
        {hint ? <div className="mt-1 text-xs text-dc-muted">{hint}</div> : null}
      </div>
      {action ? <div className="shrink-0 sm:pt-0.5">{action}</div> : null}
    </div>
  )
}

export function SettingsAccountActionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-sm font-medium text-dc-accent hover:text-dc-accent-hover hover:underline">
      {children}
    </Link>
  )
}

export function SettingsAccountActionButton({
  onClick,
  disabled,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-sm font-medium text-dc-accent hover:text-dc-accent-hover hover:underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}
