import { Link } from 'react-router-dom'

type Props = {
  onNavigate?: () => void
  /** Desktop account dropdown uses compact block links; mobile hamburger uses full-width rows. */
  variant?: 'dropdown' | 'mobile'
}

const linkClass = {
  dropdown:
    'flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-dc-text hover:bg-dc-elevated-muted md:min-h-0 md:text-dc-text-muted md:hover:text-dc-text',
  mobile:
    'flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-medium text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text',
} as const

/** Single entry point to the platform moderation console. */
export default function PlatformStaffNavLinks({ onNavigate, variant = 'dropdown' }: Props) {
  return (
    <Link to="/moderation/dashboard" className={linkClass[variant]} onClick={onNavigate}>
      Admin dashboard
    </Link>
  )
}
