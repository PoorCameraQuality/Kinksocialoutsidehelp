'use client'

import { useState, type ReactNode } from 'react'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { descriptionForTab, labelForTab, type OrganizerTab } from './organizerNavConfig'
import { OrganizerEventSidebar } from './OrganizerEventSidebar'
import { OrganizerEventHeader } from './OrganizerEventHeader'
import { cn } from '@/lib/cn'

type Props = {
  eventSlug: string
  eventTitle: string
  activeTab: OrganizerTab
  readOnly: boolean
  wideCanvas: boolean
  onSelectTab: (tab: OrganizerTab) => void
  onToggleWideCanvas: () => void
  onPreviewRole?: (role: 'attendee' | 'staff' | 'safety' | 'public') => void
  wideLayoutForTab: boolean
  hubHref?: string
  hubLabel?: string
  publicHref?: string
  permissions?: ConventionCommandPermissions
  children: ReactNode
}

export function OrganizerEventShell({
  eventSlug,
  eventTitle,
  activeTab,
  readOnly,
  wideCanvas,
  onSelectTab,
  onToggleWideCanvas,
  onPreviewRole,
  wideLayoutForTab,
  hubHref,
  hubLabel = '← All events',
  publicHref,
  permissions,
  children,
}: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pageTitle = labelForTab(activeTab)
  const pageDescription = descriptionForTab(activeTab)

  return (
    <div className="relative flex min-h-[calc(100vh-3.25rem)] w-full">
      <OrganizerEventSidebar
        eventSlug={eventSlug}
        eventTitle={eventTitle}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
        hubHref={hubHref}
        hubLabel={hubLabel}
        publicHref={publicHref}
        permissions={permissions}
      />

      <div className="relative z-0 flex min-w-0 flex-1 flex-col">
        <OrganizerEventHeader
          eventSlug={eventSlug}
          readOnly={readOnly}
          wideCanvas={wideCanvas}
          permissions={permissions}
          onOpenMenu={() => setMobileNavOpen(true)}
          onToggleWideCanvas={onToggleWideCanvas}
          onPreviewRole={onPreviewRole}
        />

        <main
          className={cn(
            'flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:py-6',
            wideCanvas && wideLayoutForTab
              ? 'max-w-[min(100%,1600px)]'
              : activeTab === 'people' ||
                  activeTab === 'registrants' ||
                  activeTab === 'import' ||
                  activeTab === 'staff'
                ? 'max-w-[min(100%,1400px)]'
                : 'max-w-5xl',
          )}
        >
          {activeTab !== 'dashboard' ? (
            <header className="mb-4 border-b border-dc-border pb-3 sm:mb-5 sm:pb-4">
              <h2 className="font-serif text-xl text-dc-text sm:text-2xl lg:text-3xl">{pageTitle}</h2>
              {pageDescription ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-muted">{pageDescription}</p>
              ) : null}
            </header>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  )
}
