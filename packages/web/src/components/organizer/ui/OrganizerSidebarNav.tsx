import { ORGANIZER_TABS, ORGANIZER_TAB_LABELS, type OrganizerTab } from '@/lib/organizer/types'
import { organizerTabIcon } from '@/components/organizer/org-console/OrganizerNavIcons'
import { cn } from '@/lib/cn'



type Props = {

  active: OrganizerTab

  onChange: (tab: OrganizerTab) => void

  showSettings?: boolean

  showModeration?: boolean

  showPayments?: boolean

}



export default function OrganizerSidebarNav({
  active,
  onChange,
  showSettings = true,
  showModeration = true,
  showPayments = false,
}: Props) {

  const tabs = ORGANIZER_TABS.filter((t) => {
        if (t === 'settings' && !showSettings) return false
    if (t === 'ecke' && !showSettings) return false
    if (t === 'moderation' && !showModeration) return false
    if ((t === 'payments' || t === 'payments-setup') && !showPayments) return false
    return true
  })



  return (

    <nav

      className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0 c2k-no-scrollbar"

      aria-label="Organizer sections"

    >

      {tabs.map((tab) => {

        const isActive = active === tab

        const Icon = organizerTabIcon(tab)

        return (

          <button

            key={tab}

            type="button"

            role="tab"

            aria-selected={isActive}

            onClick={() => onChange(tab)}

            className={`flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:w-full ${

              isActive ?

                'bg-dc-accent/15 font-medium text-dc-accent ring-1 ring-dc-accent/30'

              : 'text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'

            }`}

          >

            <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-dc-accent' : 'text-dc-text-muted')} />

            <span className="whitespace-nowrap lg:whitespace-normal">{ORGANIZER_TAB_LABELS[tab]}</span>

          </button>

        )

      })}

    </nav>

  )

}


