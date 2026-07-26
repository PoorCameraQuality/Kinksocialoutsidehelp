import type { ReactElement } from 'react'
import type { OrganizerTab } from '@/lib/organizer/types'

type IconProps = { className?: string }

type NavIcon = (props: IconProps) => ReactElement

const base = 'h-4 w-4 shrink-0'

export function NavIconHome({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
    </svg>
  )
}

export function NavIconSchedule({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M8 3v3M16 3v3M5 9h14M6 6h12a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z" />
    </svg>
  )
}

export function NavIconPeople({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M16 19v-1a4 4 0 00-8 0v1M12 11a3 3 0 100-6 3 3 0 000 6zM20 19v-1a3 3 0 00-2-2.83M4 19v-1a3 3 0 012-2.83" />
    </svg>
  )
}

export function NavIconCommunications({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M7 9h10M7 13h6M6 5h12a2 2 0 012 2v11l-4-3H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  )
}

export function NavIconModeration({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M12 3l7 4v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V7l7-4z" />
    </svg>
  )
}

export function NavIconSettings({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.2a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.2a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.2a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.2a1.7 1.7 0 00-1.5 1z" />
    </svg>
  )
}

export function NavIconTools({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M14.7 6.3a4 4 0 00-5.4 5.4l-6.6 6.6a2 2 0 102.8 2.8l6.6-6.6a4 4 0 005.4-5.4l-2 2-3.4-3.4 2-2z" />
    </svg>
  )
}

export function NavIconEcke({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M12 3v3M5 9h14M7 21h10M12 12a3 3 0 100-6 3 3 0 000 6zM4 7l2-2M20 7l-2-2" />
    </svg>
  )
}

export function NavIconPayments({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8.5A2.5 2.5 0 015.5 6h13A2.5 2.5 0 0121 8.5v7a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 15.5v-7zM3 10h18M7 15h3"
      />
    </svg>
  )
}

export function NavIconPaymentsSetup({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v3M12 18v3M4.9 6.5l2.1 2.1M17 15.4l2.1 2.1M3 12h3M18 12h3M4.9 17.5L7 15.4M17 8.6l2.1-2.1M12 8a4 4 0 100 8 4 4 0 000-8z"
      />
    </svg>
  )
}

export function organizerTabIcon(tab: OrganizerTab): NavIcon {
  switch (tab) {
    case 'home':
      return NavIconHome
    case 'schedule':
      return NavIconSchedule
    case 'people':
      return NavIconPeople
    case 'communications':
      return NavIconCommunications
    case 'moderation':
      return NavIconModeration
    case 'ecke':
      return NavIconEcke
    case 'payments':
      return NavIconPayments
    case 'payments-setup':
      return NavIconPaymentsSetup
    case 'settings':
      return NavIconSettings
    case 'tools':
      return NavIconTools
    default:
      return NavIconSettings
  }
}

/** @deprecated Prefer organizerTabIcon(tab). */
export const ORGANIZER_TAB_ICONS: Record<OrganizerTab, NavIcon> = {
  home: NavIconHome,
  schedule: NavIconSchedule,
  people: NavIconPeople,
  communications: NavIconCommunications,
  moderation: NavIconModeration,
  ecke: NavIconEcke,
  payments: NavIconPayments,
  'payments-setup': NavIconPaymentsSetup,
  settings: NavIconSettings,
  tools: NavIconTools,
}
