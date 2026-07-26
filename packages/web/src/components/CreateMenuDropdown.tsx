import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizerOrgScopes } from '@/hooks/useOrganizerOrgScopes'
import { homeNearYouHref } from '@/lib/community-nav'

export type CreateMenuItem = {
  id: string
  label: string
  description: string
  to: string
  icon: ReactNode
}

type CreateSection = {
  id: string
  title: string
  items: CreateMenuItem[]
}

function ShareIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ShopIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function PhotoIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function useCreateMenuSections(): CreateSection[] {
  const { isAuthenticated, isFallback } = useAuth()
  const signedIn = isAuthenticated && !isFallback
  const orgScopes = useOrganizerOrgScopes()
  const canOrganize = orgScopes.hasAnyScope

  if (!signedIn) {
    return [
      {
        id: 'safety',
        title: 'Safety',
        items: [
          {
            id: 'report',
            label: 'Report a concern',
            description: 'Flag abuse, harassment, or policy issues',
            to: '/support?report=1',
            icon: <ShieldIcon />,
          },
        ],
      },
    ]
  }

  const share: CreateSection = {
    id: 'share',
    title: 'Share',
    items: [
      {
        id: 'post',
        label: 'Post',
        description: 'Share an update with your community',
        to: `${homeNearYouHref()}#home-feed-composer`,
        icon: <ShareIcon />,
      },
      {
        id: 'upload',
        label: 'Photo or video',
        description: 'Upload pictures or videos with privacy controls',
        to: '/create',
        icon: <PhotoIcon />,
      },
      {
        id: 'article',
        label: 'Article',
        description: 'Write educational content',
        to: '/education/write',
        icon: <ShareIcon />,
      },
    ],
  }

  const organizeItems: CreateMenuItem[] = [
    {
      id: 'event',
      label: 'Event',
      description: 'Host a munch, class, party, or meetup',
      to: '/events?create=event',
      icon: <CalendarIcon />,
    },
    {
      id: 'group',
      label: 'Group',
      description: 'Start a local or interest-based community',
      to: '/groups/onboarding',
      icon: <UsersIcon />,
    },
  ]

  if (canOrganize) {
    organizeItems.push(
      {
        id: 'organization',
        label: 'Organization',
        description: 'Create an org hub for your collective',
        to: '/orgs/new',
        icon: <UsersIcon />,
      },
      {
        id: 'convention',
        label: 'Convention',
        description: 'Multi-day program with schedule shell',
        to: '/events?create=convention',
        icon: <CalendarIcon />,
      },
    )
  }

  const organize: CreateSection = {
    id: 'organize',
    title: 'Organize',
    items: organizeItems,
  }

  const marketplace: CreateSection = {
    id: 'marketplace',
    title: 'Marketplace',
    items: [
      {
        id: 'vendor',
        label: 'Vendor listing',
        description: 'Showcase products or services',
        to: '/vendors/new',
        icon: <ShopIcon />,
      },
    ],
  }

  const safety: CreateSection = {
    id: 'safety',
    title: 'Safety',
    items: [
      {
        id: 'report',
        label: 'Report a concern',
        description: 'Get help or flag a problem safely',
        to: '/support?report=1',
        icon: <ShieldIcon />,
      },
    ],
  }

  return [share, organize, marketplace, safety]
}

type Props = {
  className?: string
  onNavigate?: () => void
  /** sheet = full-width mobile list with 44px targets */
  variant?: 'dropdown' | 'sheet'
}

export default function CreateMenuDropdown({ className = '', onNavigate, variant = 'dropdown' }: Props) {
  const sections = useCreateMenuSections()

  if (variant === 'sheet') {
    return (
      <div className={`space-y-5 ${className}`.trim()} role="menu" aria-label="Create">
        {sections.map((section) => (
          <section key={section.id}>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-dc-muted">{section.title}</h3>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.id} role="none">
                  <Link
                    role="menuitem"
                    to={item.to}
                    onClick={onNavigate}
                    className="flex min-h-touch items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-dc-elevated-muted"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dc-accent/15 text-dc-accent">
                      {item.icon}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="block text-base font-medium text-dc-text">{item.label}</span>
                      <span className="block text-sm text-dc-muted">{item.description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className={`py-1 ${className}`.trim()} role="menu" aria-label="Create">
      {sections.map((section, idx) => (
        <div key={section.id} className={idx > 0 ? 'mt-2 border-t border-dc-border pt-2' : ''}>
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-dc-muted">{section.title}</p>
          <ul>
            {section.items.map((item) => (
              <li key={item.id} role="none">
                <Link
                  role="menuitem"
                  to={item.to}
                  onClick={onNavigate}
                  className="flex min-h-touch items-center gap-2 rounded-lg px-3 py-2 text-sm text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
                >
                  <span className="text-dc-accent">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
