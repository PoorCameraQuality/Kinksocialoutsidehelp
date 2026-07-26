import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { siteConfig } from '@/config/site.config'
import { navLinkIsActive } from '@/lib/nav-link-active'
import { suppressMobileBottomNav } from '@/lib/mobile-chrome'
import { useAuth } from '@/contexts/AuthContext'
import { useConversationsPreview } from '@/hooks/useConversationsPreview'
import { useNotificationsList } from '@/hooks/useNotificationsList'
import { scrollAppToTop } from '@/lib/scroll-app-to-top'

const ICONS = {
  home: HomeIcon,
  explore: ExploreIcon,
  events: EventsIcon,
  messages: MessagesIcon,
  me: MeIcon,
} as const

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function ExploreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function EventsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function MeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/profile/')
  }
  if (href === '/events') {
    return pathname === '/events' || pathname.startsWith('/events/')
  }
  return navLinkIsActive(pathname, href)
}

export default function BottomNav() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isFallback } = useAuth()
  const { unreadCount: msgUnread } = useConversationsPreview()
  const { unreadCount: notifUnread } = useNotificationsList()
  const showMsgBadge = isAuthenticated && !isFallback && msgUnread > 0
  const showMeBadge = isAuthenticated && !isFallback && notifUnread > 0

  if (!isAuthenticated || isFallback) {
    return null
  }

  if (suppressMobileBottomNav(pathname, searchParams)) {
    return null
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-dc-border bg-dc-elevated/95 shadow-[var(--dc-shadow-soft)] backdrop-blur-md safe-area-pb"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="flex h-[var(--c2k-bottom-nav-h)] items-stretch justify-around px-1">
        {siteConfig.bottomNav.map((item) => {
          const isActive = isNavItemActive(pathname, item.href)
          const Icon = ICONS[item.iconKey]
          const isMessages = item.href === '/messaging'
          const isMe = item.href === '/profile'
          const badge =
            isMessages && showMsgBadge ? msgUnread
            : isMe && showMeBadge ? notifUnread
            : 0

          return (
            <Link
              key={item.href}
              to={item.href === '/profile' ? '/profile' : item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                scrollAppToTop()
              }}
              className={`relative flex min-h-touch min-w-[4.25rem] flex-1 max-w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-colors ${
                isActive ?
                  'bg-dc-accent-muted/60 font-semibold text-dc-accent'
                : 'text-dc-muted hover:text-dc-text'
              }`}
            >
              <Icon className={`h-6 w-6 shrink-0 ${isActive ? 'text-dc-accent' : ''}`} />
              {badge > 0 ?
                <span className="absolute right-1 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-dc-accent px-1 text-[9px] font-bold text-dc-accent-foreground">
                  {badge > 9 ? '9+' : badge}
                </span>
              : null}
              <span className={`text-[11px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
