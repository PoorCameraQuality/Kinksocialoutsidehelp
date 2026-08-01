import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import Dialog from '@/components/ui/Dialog'
import type { StudioSectionStatus } from '@/lib/profile-studio/completion'

export type ProfileEditTabId = 'overview' | 'photos' | 'identity' | 'interests' | 'presence'

/** Legacy tab ids kept for redirect helpers and external deep links. */
export type LegacyProfileEditTabId =
  | 'basics'
  | 'about'
  | 'looking-for'
  | 'relationships'
  | 'privacy'
  | 'links'

export const PROFILE_EDIT_TABS: {
  id: ProfileEditTabId
  label: string
  description: string
  path: string
  mobileLabel?: string
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'First impression — name, location, and about you.',
    path: '/profile/edit',
    mobileLabel: 'Overview',
  },
  {
    id: 'photos',
    label: 'Photos',
    description: 'Profile picture and curated gallery.',
    path: '/profile/edit/photos',
    mobileLabel: 'Photos',
  },
  {
    id: 'identity',
    label: 'Identity',
    description: 'Roles, pronouns, orientations, and community labels.',
    path: '/profile/edit/identity',
    mobileLabel: 'Identity',
  },
  {
    id: 'interests',
    label: 'Interests',
    description: 'Tags that help people find shared context.',
    path: '/profile/edit/interests',
    mobileLabel: 'Interests',
  },
  {
    id: 'presence',
    label: 'Presence',
    description: 'Connection goals, relationships, links, and visibility.',
    path: '/profile/edit/presence',
    mobileLabel: 'Presence',
  },
]

export function resolveActiveProfileEditTab(pathname: string): ProfileEditTabId {
  if (pathname === '/profile/edit' || pathname === '/profile/edit/') return 'overview'
  const match = PROFILE_EDIT_TABS.find(
    (tab) => tab.id !== 'overview' && pathname.startsWith(tab.path),
  )
  return match?.id ?? 'overview'
}

export function getProfileEditTab(id: ProfileEditTabId) {
  return PROFILE_EDIT_TABS.find((tab) => tab.id === id)
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors border ${
    isActive ?
      'bg-dc-accent/10 text-dc-text border-dc-accent/30'
    : 'text-dc-muted hover:text-dc-text hover:bg-dc-elevated/60 border-transparent'
  }`

function SectionBadge({ status }: { status?: StudioSectionStatus }) {
  if (!status) {
    return (
      <span className="shrink-0 text-dc-muted text-xs" aria-hidden>
        ○
      </span>
    )
  }
  if (status.complete) {
    return (
      <span className="shrink-0 text-emerald-400 text-xs" aria-label="Section ready">
        ✓
      </span>
    )
  }
  if (status.progressLabel) {
    return (
      <span className="shrink-0 text-dc-accent text-xs" aria-label="Section in progress">
        ●
      </span>
    )
  }
  return (
    <span className="shrink-0 text-dc-muted text-xs" aria-hidden>
      ○
    </span>
  )
}

function readySectionCount(sectionStatus?: Partial<Record<ProfileEditTabId, StudioSectionStatus>>): number {
  return PROFILE_EDIT_TABS.filter((tab) => sectionStatus?.[tab.id]?.complete).length
}

type Props = {
  onboarding?: boolean
  sectionStatus?: Partial<Record<ProfileEditTabId, StudioSectionStatus>>
}

function NavItem({
  tab,
  sectionStatus,
  end,
}: {
  tab: (typeof PROFILE_EDIT_TABS)[number]
  sectionStatus?: Partial<Record<ProfileEditTabId, StudioSectionStatus>>
  end?: boolean
}) {
  return (
    <NavLink to={tab.path} end={end} className={linkClass}>
      <SectionBadge status={sectionStatus?.[tab.id]} />
      <span className="min-w-0 font-medium leading-snug">{tab.label}</span>
    </NavLink>
  )
}

export default function ProfileEditTabNav({ onboarding, sectionStatus }: Props) {
  const { pathname } = useLocation()
  const [sheetOpen, setSheetOpen] = useState(false)

  if (onboarding) return null

  const activeId = resolveActiveProfileEditTab(pathname)
  const activeTab = getProfileEditTab(activeId) ?? PROFILE_EDIT_TABS[0]
  const activeIdx = PROFILE_EDIT_TABS.findIndex((tab) => tab.id === activeId)
  const readyCount = readySectionCount(sectionStatus)

  return (
    <nav aria-label="Profile studio sections">
      <p className="mb-1 hidden px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-dc-muted lg:block">
        Profile Studio
      </p>
      <p className="mb-3 hidden px-1 text-xs text-dc-muted lg:block">
        {readyCount} of {PROFILE_EDIT_TABS.length} sections ready
      </p>

      <ul className="hidden gap-1 lg:flex lg:flex-col">
        {PROFILE_EDIT_TABS.map((tab) => (
          <li key={tab.id}>
            <NavItem tab={tab} sectionStatus={sectionStatus} end={tab.id === 'overview'} />
          </li>
        ))}
      </ul>

      <div className="lg:hidden">
        <p className="mb-1 text-[11px] font-medium text-dc-muted">
          {activeTab.mobileLabel ?? activeTab.label} · Section {activeIdx + 1} of {PROFILE_EDIT_TABS.length}
        </p>
        <p className="mb-2 text-[11px] text-dc-muted">
          {readyCount} of {PROFILE_EDIT_TABS.length} sections ready
        </p>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated/40 px-4 text-sm font-medium text-dc-text hover:bg-dc-elevated-muted"
        >
          Change section
        </button>
      </div>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Profile sections"
        description={`${readyCount} of ${PROFILE_EDIT_TABS.length} sections ready`}
        variant="sheet"
        maxWidthClass="max-w-lg"
      >
        <ul className="divide-y divide-dc-border">
          {PROFILE_EDIT_TABS.map((tab) => (
            <li key={tab.id}>
              <NavLink
                to={tab.path}
                end={tab.id === 'overview'}
                onClick={() => setSheetOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-1 py-3.5 text-sm ${
                    isActive ? 'text-dc-accent font-semibold' : 'text-dc-text hover:text-dc-accent'
                  }`
                }
              >
                <SectionBadge status={sectionStatus?.[tab.id]} />
                <span>{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </Dialog>
    </nav>
  )
}
