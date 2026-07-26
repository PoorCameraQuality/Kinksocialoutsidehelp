import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { railNavShellClass } from '@/lib/card-surface'

export type SettingsTabId =
  | 'account'
  | 'profile'
  | 'privacy'
  | 'notifications'
  | 'activity'
  | 'muted'
  | 'blocked'
  | 'payment-history'
  | 'trust'
  | 'ecosystem'
  | 'vendor'

const TABS: { id: SettingsTabId; label: string; path: string }[] = [
  { id: 'account', label: 'Account', path: '/settings/account' },
  { id: 'profile', label: 'Profile', path: '/settings/profile' },
  { id: 'privacy', label: 'Privacy', path: '/settings/privacy' },
  { id: 'notifications', label: 'Notifications', path: '/settings/notifications' },
  { id: 'activity', label: 'Activity feed', path: '/settings/activity' },
  { id: 'muted', label: 'Muted', path: '/settings/muted' },
  { id: 'blocked', label: 'Blocked', path: '/settings/blocked' },
  { id: 'payment-history', label: 'Event access', path: '/settings/payment-history' },
  { id: 'trust', label: 'Trust & standing', path: '/settings/trust' },
  { id: 'ecosystem', label: 'Presenter & roles', path: '/settings/ecosystem' },
  { id: 'vendor', label: 'Vendor shop', path: '/settings/vendor' },
]

export default function SettingsTabNav() {
  return (
    <nav aria-label="Settings sections" className={cn(railNavShellClass, 'lg:mb-0 lg:w-44 lg:shrink-0 lg:p-3')}>
      <p className="mb-3 hidden px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-dc-muted lg:block">
        Settings
      </p>
      <ul className="flex gap-1 overflow-x-auto pb-1 c2k-no-scrollbar lg:flex-col lg:space-y-1 lg:overflow-visible lg:pb-0">
        {TABS.map((tab) => (
          <li key={tab.id} className="shrink-0 lg:shrink">
            <NavLink
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  isActive ?
                    'border-dc-accent/30 bg-dc-accent/10 text-dc-text'
                  : 'border-transparent text-dc-muted hover:bg-dc-elevated-muted hover:text-dc-text',
                )
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { TABS }
