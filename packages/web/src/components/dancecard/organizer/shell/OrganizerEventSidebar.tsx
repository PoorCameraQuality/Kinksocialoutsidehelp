'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConventionCommandPermissions } from '@c2k/shared'
import {
  ORGANIZER_SIDEBAR_SECTIONS,
  type OrganizerTab,
} from '@/components/dancecard/organizer/shell/organizerNavConfig'
import { filterNavByPermissions } from '@/lib/dancecard/commandBridgeNavPermissions'
import { useOrganizerSubPath } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { cn } from '@/lib/cn'

type Props = {
  eventSlug: string
  eventTitle: string
  activeTab: OrganizerTab
  onSelectTab: (tab: OrganizerTab) => void
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  hubHref?: string
  hubLabel?: string
  publicHref?: string
  permissions?: ConventionCommandPermissions
}
function defaultExpandedSections(sections: typeof ORGANIZER_SIDEBAR_SECTIONS): Record<string, boolean> {
  const init: Record<string, boolean> = {}
  for (const section of sections) {
    init[section.id] = true
  }
  return init
}

export function OrganizerEventSidebar({
  eventSlug,
  eventTitle,
  activeTab,
  onSelectTab,
  mobileOpen,
  onMobileOpenChange,
  hubHref = '/organizer',
  hubLabel = '← All events',
  publicHref,
  permissions,
}: Props) {
  const doorHref = useOrganizerSubPath('/door')
  const navSections = useMemo(
    () => (permissions ? filterNavByPermissions(ORGANIZER_SIDEBAR_SECTIONS, permissions) : ORGANIZER_SIDEBAR_SECTIONS),
    [permissions],
  )
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => defaultExpandedSections(navSections))

  const activeSectionId = useMemo(() => {
    for (const section of navSections) {
      if (section.items.some((i) => i.key === activeTab)) return section.id
    }
    return 'home'
  }, [activeTab, navSections])

  useEffect(() => {
    setExpanded((prev) => ({ ...prev, [activeSectionId]: true }))
  }, [activeSectionId])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileOpenChange])

  const toggleSection = useCallback((sectionId: string) => {
    setExpanded((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }, [])

  const title = eventTitle || eventSlug

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-dc-surface/80 md:hidden"
          aria-label="Close menu"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      <aside
        className={cn(
          'flex w-[17rem] shrink-0 flex-col border-r border-dc-border bg-dc-surface-muted',
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-2xl',
          'max-md:transition-transform max-md:duration-200',
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:pointer-events-none max-md:-translate-x-full',
          'md:relative md:z-20 md:translate-x-0 md:pointer-events-auto',
        )}
        aria-label="Event navigation"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-4">
          <div className="mb-4 space-y-2 px-3">
            <Link href={hubHref} className="text-xs font-medium text-dc-accent hover:text-dc-accent-hover">
              {hubLabel}
            </Link>
            <p className="mt-2 font-serif text-lg leading-snug text-dc-text">{title}</p>
            <p className="font-mono text-xs text-dc-muted">{eventSlug}</p>
            {publicHref ? (
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href={publicHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-dc-border bg-dc-elevated px-3 py-2 text-center text-xs font-medium text-dc-text hover:border-dc-accent-border"
                >
                  View public page ↗
                </Link>
                {permissions?.registration || permissions?.isFullAdmin ? (
                  <Link
                    href={doorHref}
                    className="rounded-lg border border-dc-accent-border bg-dc-accent-muted px-3 py-2 text-center text-xs font-semibold text-dc-accent hover:bg-dc-accent-muted/80"
                  >
                    Open door mode
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <nav className="flex-1 space-y-1" aria-label="Event sections">
            {navSections.map((section) => {
              const isOpen = expanded[section.id] ?? true
              const sectionActive = section.id === activeSectionId
              const single = section.items.length === 1 ? section.items[0] : null
              return (
                <div key={section.id} className="rounded-lg">
                  {single ? (
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                        single.key === activeTab
                          ? 'bg-dc-accent-muted text-dc-accent'
                          : sectionActive
                            ? 'text-dc-accent'
                            : 'text-dc-muted hover:bg-dc-elevated-muted/80 hover:text-dc-text',
                      )}
                      aria-current={single.key === activeTab ? 'page' : undefined}
                      onClick={() => {
                        onSelectTab(single.key)
                        onMobileOpenChange(false)
                      }}
                    >
                      {section.label}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide',
                          sectionActive ? 'text-dc-accent' : 'text-dc-muted hover:text-dc-text',
                        )}
                        aria-expanded={isOpen}
                        onClick={() => toggleSection(section.id)}
                      >
                        <span>{section.label}</span>
                        <span className="text-[10px] opacity-70" aria-hidden>
                          {isOpen ? '▾' : '▸'}
                        </span>
                      </button>
                      {isOpen ? (
                        <ul className="mt-0.5 space-y-0.5 pb-2">
                          {section.items.map((item) => {
                            const active = item.key === activeTab
                            return (
                              <li key={item.key}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectTab(item.key)
                                    onMobileOpenChange(false)
                                  }}
                                  className={cn(
                                    'w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                                    active
                                      ? 'bg-dc-accent-muted text-dc-accent'
                                      : 'text-dc-muted hover:bg-dc-elevated-muted/80 hover:text-dc-text',
                                  )}
                                  aria-current={active ? 'page' : undefined}
                                >
                                  {item.label}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                    </>
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      </aside>
    </>
  )
}
