import { useLocation } from 'react-router-dom'

import { NavLink } from 'react-router-dom'

import type { StudioSectionStatus } from '@/lib/profile-studio/completion'



export type ProfileEditTabId =

  | 'basics'

  | 'about'

  | 'identity'

  | 'looking-for'

  | 'relationships'

  | 'interests'

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

    id: 'basics',

    label: 'Profile Story',

    description: 'How people understand you at first glance.',

    path: '/profile/edit',

    mobileLabel: 'Story',

  },

  {

    id: 'about',

    label: 'About',

    description: 'Your profile story — intro, tagline, and depth.',

    path: '/profile/edit/about',

    mobileLabel: 'About',

  },

  {

    id: 'identity',

    label: 'Identity & Community',

    description: 'Roles, pronouns, experience, and community labels.',

    path: '/profile/edit/identity',

    mobileLabel: 'Identity',

  },

  {

    id: 'looking-for',

    label: 'Looking For',

    description: 'Friends, event companions, study partners, and more.',

    path: '/profile/edit/looking-for',

    mobileLabel: 'Looking for',

  },

  {

    id: 'interests',

    label: 'Interests & Discovery',

    description: 'Tags that help people find shared context.',

    path: '/profile/edit/interests',

    mobileLabel: 'Interests',

  },

  {

    id: 'privacy',

    label: 'Privacy & Visibility',

    description: 'Public, logged-in, connections-only, or private.',

    path: '/profile/edit/privacy',

    mobileLabel: 'Privacy',

  },

  {

    id: 'links',

    label: 'Links & Presence',

    description: 'Websites, socials, and public references.',

    path: '/profile/edit/links',

    mobileLabel: 'Links',

  },

  {

    id: 'relationships',

    label: 'Connections & relationships',

    description: 'Partnerships and D/s visibility.',

    path: '/profile/edit/relationships',

    mobileLabel: 'Relationships',

  },

]



const linkClass = ({ isActive }: { isActive: boolean }) =>

  `flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors border ${

    isActive ?

      'bg-dc-accent/10 text-dc-text border-dc-accent/30'

    : 'text-dc-muted hover:text-dc-text hover:bg-dc-elevated/60 border-transparent'

  }`



function SectionBadge({ status }: { status?: StudioSectionStatus }) {

  if (!status) return null

  if (status.complete) {

    return (

      <span className="mt-0.5 shrink-0 text-emerald-400 text-xs" aria-label="Section complete">

        ✓

      </span>

    )

  }

  if (status.progressLabel) {

    return (

      <span className="mt-0.5 shrink-0 rounded-full bg-dc-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-dc-accent">

        {status.progressLabel}

      </span>

    )

  }

  return (

    <span className="mt-0.5 shrink-0 text-dc-muted text-xs" aria-hidden>

      ○

    </span>

  )

}



function activeTabIndex(pathname: string): number {

  const idx = PROFILE_EDIT_TABS.findIndex((tab) =>

    tab.id === 'basics' ? pathname === tab.path || pathname === `${tab.path}/` : pathname.startsWith(tab.path),

  )

  return idx >= 0 ? idx : 0

}



type Props = {

  onboarding?: boolean

  sectionStatus?: Partial<Record<ProfileEditTabId, StudioSectionStatus>>

}



export default function ProfileEditTabNav({ onboarding, sectionStatus }: Props) {

  const { pathname } = useLocation()



  if (onboarding) return null



  const activeIdx = activeTabIndex(pathname)

  const activeTab = PROFILE_EDIT_TABS[activeIdx]



  return (

    <nav aria-label="Profile studio sections">

      <p className="mb-3 hidden px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-dc-muted lg:block">

        Profile studio

      </p>

      <ul className="hidden gap-1 lg:flex lg:flex-col">

        {PROFILE_EDIT_TABS.map((tab) => (

          <li key={tab.id}>

            <NavLink to={tab.path} end={tab.id === 'basics'} className={linkClass}>

              <SectionBadge status={sectionStatus?.[tab.id]} />

              <span className="min-w-0">

                <span className="block font-medium leading-snug">{tab.label}</span>

                <span className="mt-0.5 block text-[11px] leading-snug text-dc-muted">{tab.description}</span>

              </span>

            </NavLink>

          </li>

        ))}

      </ul>

      <div className="lg:hidden">

        <p className="mb-2 text-[11px] font-medium text-dc-muted">

          {activeTab?.mobileLabel ?? activeTab?.label} · Section {activeIdx + 1} of {PROFILE_EDIT_TABS.length}

        </p>

        <div className="relative">

          <div

            className="c2k-no-scrollbar flex gap-2 overflow-x-auto pb-1 pl-0.5 pr-6"

            role="tablist"

            aria-label="Profile section"

          >

            {PROFILE_EDIT_TABS.map((tab) => (

              <NavLink

                key={tab.id}

                to={tab.path}

                end={tab.id === 'basics'}

                className={({ isActive }) =>

                  `inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${

                    isActive ?

                      'border-dc-accent bg-dc-accent text-dc-accent-foreground'

                    : sectionStatus?.[tab.id]?.complete ?

                      'border-emerald-500/35 bg-emerald-500/10 text-dc-text-muted'

                    : 'border-dc-border bg-dc-elevated-solid text-dc-text-muted'

                  }`

                }

              >

                {sectionStatus?.[tab.id]?.complete ?

                  <span className="text-[10px] text-emerald-400" aria-hidden>

                    ✓

                  </span>

                : null}

                {tab.mobileLabel ?? tab.label}

              </NavLink>

            ))}

          </div>

          <div

            className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-dc-surface to-transparent"

            aria-hidden

          />

        </div>

      </div>

    </nav>

  )

}


