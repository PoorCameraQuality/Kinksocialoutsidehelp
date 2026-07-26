import { Link } from 'react-router-dom'
import { buildAccountManageShortcuts } from '@/lib/account-manage-shortcuts'
import type { UserEcosystemPayload } from '@/lib/user-ecosystem'

type Props = {
  ecosystem: UserEcosystemPayload | null
  loading?: boolean
  onNavigate?: () => void
  variant?: 'dropdown' | 'mobile'
}

const linkClass = {
  dropdown:
    'flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-dc-text hover:bg-dc-elevated-muted md:min-h-0 md:text-dc-text-muted md:hover:text-dc-text',
  mobile:
    'flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-medium text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text',
} as const

export default function AccountManageNavLinks({
  ecosystem,
  loading = false,
  onNavigate,
  variant = 'dropdown',
}: Props) {
  const cls = linkClass[variant]

  if (loading && !ecosystem) {
    return (
      <div className="space-y-1" aria-live="polite" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="min-h-11 animate-pulse rounded-lg bg-dc-elevated-muted px-3" />
        ))}
      </div>
    )
  }

  const shortcuts = buildAccountManageShortcuts(ecosystem)

  return (
    <>
      {shortcuts.map((item) => (
        <Link key={`${item.href}-${item.label}`} to={item.href} className={cls} onClick={onNavigate}>
          {item.label}
        </Link>
      ))}
    </>
  )
}
