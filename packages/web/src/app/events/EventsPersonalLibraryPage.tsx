import { useId, useMemo, useState } from 'react'
import EventCard from '@/components/cards/EventCard'
import EventsDiscoverLeftRail from '@/components/events/EventsDiscoverLeftRail'
import EventsPersonalCompactFilters from '@/components/events/EventsPersonalCompactFilters'
import EventsPersonalRightRail from '@/components/events/EventsPersonalRightRail'
import PersonalRegistrationRow from '@/components/events/PersonalRegistrationRow'
import PageHeader from '@/components/shell/PageHeader'
import DirectoryTemplate from '@/components/templates/DirectoryTemplate'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/contexts/AuthContext'
import { BOOKMARK_OBJECT_EVENT, useApiBookmarks } from '@/hooks/useApiBookmarks'
import { useApiEvents } from '@/hooks/useApiEvents'
import { useEventsAgendaSidebar } from '@/hooks/useEventsAgendaSidebar'
import { useApiMyRsvps, type ApiMyRsvpItem } from '@/hooks/useApiMyRsvps'
import { bookmarkEventToMockEvent } from '@/lib/bookmark-event-mapper'
import { eventStartDate } from '@/lib/events-page-utils'
import type { EventsSectionMode } from '@/lib/events-section-mode'
import { RSVP_LABEL_INTERESTED } from '@c2k/shared'

type RegistrationsTab = 'upcoming' | 'pending' | 'past'
type HostedTab = 'upcoming' | 'drafts' | 'staffed' | 'past'

const COMPACT_FILTER_THRESHOLD = 10

function isPendingRegistration(r: ApiMyRsvpItem): boolean {
  if (r.status === 'waitlist') return true
  return r.status === 'going' && r.rsvpApprovalStatus === 'pending'
}

const PAGE_META: Record<
  Exclude<EventsSectionMode, 'discover' | 'past-public'>,
  { title: string; subtitle: string }
> = {
  registrations: {
    title: 'My RSVPs & registrations',
    subtitle: 'Events and conventions you RSVP’d to, registered for, or have access to.',
  },
  hosted: {
    title: 'My Hosted Events',
    subtitle: 'Events you organize, host, co-host, or staff.',
  },
  saved: {
    title: 'Saved Events',
    subtitle: 'Events you bookmarked for later.',
  },
  'past-attended': {
    title: 'Past Attended',
    subtitle: 'Events you attended, RSVP’d to, or registered for in the past.',
  },
}

const REGISTRATION_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: RSVP_LABEL_INTERESTED },
  { value: 'waitlist', label: 'Waitlist' },
] as const

function inDateRange(iso: string, start: string, end: string): boolean {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return true
  if (start) {
    const s = new Date(start).getTime()
    if (!Number.isNaN(s) && t < s) return false
  }
  if (end) {
    const e = new Date(end).getTime()
    if (!Number.isNaN(e) && t > e + 24 * 60 * 60 * 1000 - 1) return false
  }
  return true
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-medium transition-colors ${
        active ? 'bg-dc-accent-muted text-dc-accent' : 'text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text'
      }`}
    >
      {children}
    </button>
  )
}

type Props = {
  mode: EventsSectionMode
}

export default function EventsPersonalLibraryPage({ mode }: Props) {
  const searchId = useId()
  const { isAuthenticated, isFallback } = useAuth()
  const homeDemoFallbackEnv = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'
  const useDemoFallback = homeDemoFallbackEnv && !isAuthenticated
  const showApi = isAuthenticated && !isFallback && !useDemoFallback

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [regTab, setRegTab] = useState<RegistrationsTab>('upcoming')
  const [hostedTab, setHostedTab] = useState<HostedTab>('upcoming')
  const [navDrawerOpen, setNavDrawerOpen] = useState(false)

  const myRsvps = useApiMyRsvps(showApi && (mode === 'registrations' || mode === 'past-attended'))
  const hostedEvents = useApiEvents({ hostId: 'me', enabled: showApi && mode === 'hosted' })
  const bookmarks = useApiBookmarks(showApi && mode === 'saved')
  const agenda = useEventsAgendaSidebar()

  const meta = PAGE_META[mode as keyof typeof PAGE_META]
  if (!meta) return null

  const now = Date.now()

  const savedEventCards = useMemo(() => {
    return bookmarks.items
      .filter((item) => item.objectType === BOOKMARK_OBJECT_EVENT && item.event)
      .map((item) => bookmarkEventToMockEvent(item.event!))
  }, [bookmarks.items])

  const personalRecordCount = useMemo(() => {
    if (mode === 'registrations' || mode === 'past-attended') return myRsvps.items.length
    if (mode === 'hosted') return hostedEvents.status === 'ready' ? hostedEvents.items.length : 0
    if (mode === 'saved') return savedEventCards.length
    return 0
  }, [mode, myRsvps.items.length, hostedEvents.items.length, hostedEvents.status, savedEventCards.length])

  const showCompactFilters = personalRecordCount > COMPACT_FILTER_THRESHOLD

  const filteredRsvps = useMemo(() => {
    let items = myRsvps.items
    const q = searchQuery.trim().toLowerCase()
    if (q) items = items.filter((r) => r.title.toLowerCase().includes(q))
    if (showCompactFilters && statusFilter !== 'all') {
      items = items.filter((r) => r.status === statusFilter)
    }
    if (showCompactFilters && (dateStart || dateEnd)) {
      items = items.filter((r) => inDateRange(r.startsAt, dateStart, dateEnd))
    }

    return items.filter((r) => {
      const t = new Date(r.startsAt).getTime()
      const isPast = !Number.isNaN(t) && t < now
      if (mode === 'past-attended') return isPast
      if (regTab === 'past') return isPast
      if (regTab === 'pending') return isPendingRegistration(r) && !isPast
      return !isPast && !isPendingRegistration(r)
    })
  }, [myRsvps.items, searchQuery, regTab, mode, now, showCompactFilters, statusFilter, dateStart, dateEnd])

  const hostedBuckets = useMemo(() => {
    const items = hostedEvents.status === 'ready' ? hostedEvents.items : []
    let filtered = items
    const q = searchQuery.trim().toLowerCase()
    if (q) filtered = filtered.filter((e) => e.title.toLowerCase().includes(q))
    if (showCompactFilters && (dateStart || dateEnd)) {
      filtered = filtered.filter((e) => {
        const iso = e.startsAt ?? ''
        return iso ? inDateRange(iso, dateStart, dateEnd) : true
      })
    }

    const upcoming: typeof filtered = []
    const past: typeof filtered = []
    for (const ev of filtered) {
      const d = eventStartDate(ev)
      const t = d?.getTime() ?? NaN
      if (!Number.isNaN(t) && t < now) past.push(ev)
      else upcoming.push(ev)
    }
    return { upcoming, past, all: filtered }
  }, [hostedEvents.items, hostedEvents.status, searchQuery, now, showCompactFilters, dateStart, dateEnd])

  const filteredSavedEvents = useMemo(() => {
    let list = savedEventCards
    const q = searchQuery.trim().toLowerCase()
    if (q) list = list.filter((e) => e.title.toLowerCase().includes(q))
    if (showCompactFilters && (dateStart || dateEnd)) {
      list = list.filter((e) => {
        const iso = e.startsAt ?? ''
        return iso ? inDateRange(iso, dateStart, dateEnd) : true
      })
    }
    return list
  }, [savedEventCards, searchQuery, showCompactFilters, dateStart, dateEnd])

  const emptyRegistrations = (tab: RegistrationsTab) => {
    if (tab === 'pending') {
      return {
        title: 'No pending registrations',
        message:
          'You land here when an event is full (waitlist) or the host must approve your Going RSVP. Interested RSVPs stay under Upcoming.',
        ctaLabel: 'Find events',
        ctaHref: '/events',
      }
    }
    if (tab === 'past' || mode === 'past-attended') {
      return {
        title: mode === 'past-attended' ? 'No past events yet' : 'No past registrations',
        message:
          mode === 'past-attended' ?
            'After you attend events through Kink Social, they will appear here.'
          : 'Events you attended or registered for in the past will show up here.',
        ctaLabel: 'Browse events',
        ctaHref: '/events',
      }
    }
    return {
      title: 'No registrations yet',
      message: 'When you RSVP, register, or receive event access, it will show up here.',
      ctaLabel: 'Find events',
      ctaHref: '/events',
      secondaryCtaLabel: 'Browse conventions',
      secondaryCtaHref: '/conventions',
    }
  }

  const renderFilterControls = () => {
    if (!showCompactFilters) return null
    const showStatus = mode === 'registrations' || mode === 'past-attended'
    return (
      <EventsPersonalCompactFilters
        searchId={searchId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={[...REGISTRATION_STATUS_OPTIONS]}
        showStatus={showStatus}
        dateStart={dateStart}
        dateEnd={dateEnd}
        onDateStartChange={setDateStart}
        onDateEndChange={setDateEnd}
      />
    )
  }

  const renderHostedBody = () => {
    if (hostedTab === 'drafts' || hostedTab === 'staffed') {
      return (
        <EmptyState
          inline
          title={hostedTab === 'drafts' ? 'No drafts yet' : 'No staffed events yet'}
          message={
            hostedTab === 'drafts' ?
              'Draft events you are preparing will appear here.'
            : 'When an organizer adds you as staff, those events will appear here.'
          }
          ctaLabel="Create event"
          onAction={() => document.querySelector<HTMLElement>('[data-create-trigger]')?.click()}
        />
      )
    }

    const list = hostedTab === 'past' ? hostedBuckets.past : hostedBuckets.upcoming
    if (hostedEvents.status === 'loading') {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" />
          ))}
        </div>
      )
    }
    if (hostedEvents.status === 'error') {
      return (
        <EmptyState
          inline
          title="Could not load your events"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={hostedEvents.reload}
        />
      )
    }
    if (list.length === 0) {
      return (
        <EmptyState
          inline
          title="You are not organizing any events yet"
          message="Create your first event, or ask an organizer to add you as staff."
          ctaLabel="Create event"
          onAction={() => document.querySelector<HTMLElement>('[data-create-trigger]')?.click()}
          secondaryCtaLabel="Open organizer tools"
          secondaryCtaHref="/organizer"
        />
      )
    }
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {list.map((event) => (
          <EventCard key={String(event.id)} event={event} />
        ))}
      </div>
    )
  }

  const renderRegistrationsBody = () => {
    if (!showApi && useDemoFallback) {
      return (
        <EmptyState
          inline
          title="Sign in to see registrations"
          message="Your RSVPs and event access appear here after you sign in."
          ctaLabel="Sign in"
          ctaHref="/login"
        />
      )
    }
    if (myRsvps.status === 'loading') {
      return (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-dc-elevated-muted" />
          ))}
        </div>
      )
    }
    if (myRsvps.status === 'error') {
      return (
        <EmptyState
          inline
          title="Could not load registrations"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={myRsvps.reload}
        />
      )
    }
    if (filteredRsvps.length === 0) {
      const e = emptyRegistrations(mode === 'past-attended' ? 'past' : regTab)
      return (
        <EmptyState
          inline
          title={e.title}
          message={e.message}
          ctaLabel={e.ctaLabel}
          ctaHref={e.ctaHref}
          secondaryCtaLabel={e.secondaryCtaLabel}
          secondaryCtaHref={e.secondaryCtaHref}
        />
      )
    }
    return (
      <div className="space-y-3">
        {filteredRsvps.map((item) => (
          <PersonalRegistrationRow key={item.eventId} item={item} />
        ))}
      </div>
    )
  }

  const renderSavedBody = () => {
    if (!showApi && useDemoFallback) {
      return (
        <EmptyState
          inline
          title="Sign in to save events"
          message="Bookmark events while browsing to build your saved list."
          ctaLabel="Sign in"
          ctaHref="/login"
        />
      )
    }
    if (bookmarks.status === 'loading') {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" />
          ))}
        </div>
      )
    }
    if (bookmarks.status === 'error') {
      return (
        <EmptyState
          inline
          title="Could not load saved events"
          message={bookmarks.error ?? 'Check your connection and try again.'}
          actionLabel="Retry"
          onAction={bookmarks.reload}
        />
      )
    }
    if (filteredSavedEvents.length === 0) {
      return (
        <EmptyState
          inline
          title="No saved events yet"
          message="Save events while browsing so you can come back to them."
          ctaLabel="Browse events"
          ctaHref="/events"
          secondaryCtaLabel="All saved items"
          secondaryCtaHref="/saved"
        />
      )
    }
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filteredSavedEvents.map((event) => (
          <EventCard key={String(event.id)} event={event} />
        ))}
      </div>
    )
  }

  return (
    <DirectoryTemplate
      title={meta.title}
      description={meta.subtitle}
      className="py-4 sm:py-6"
      desktopAsideFrom="lg"
      header={
        <PageHeader
          eyebrow="My events"
          title={meta.title}
          description={meta.subtitle}
          sticky={false}
          className="mb-4 lg:mb-6"
          actions={
            mode === 'hosted' ?
              <button
                type="button"
                data-create-trigger
                className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                + Create event
              </button>
            : undefined
          }
        />
      }
      desktopSidebar={
        <EventsDiscoverLeftRail showDiscoverFilters={false} {...agenda} />
      }
      desktopAside={<EventsPersonalRightRail mode={mode} />}
    >
      <button
        type="button"
        onClick={() => setNavDrawerOpen(!navDrawerOpen)}
        className="mb-4 inline-flex min-h-11 items-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-accent lg:hidden"
        aria-expanded={navDrawerOpen}
      >
        Event sections
      </button>
      {navDrawerOpen ?
        <div className="mb-6 lg:hidden">
          <EventsDiscoverLeftRail showDiscoverFilters={false} {...agenda} />
        </div>
      : null}

      {mode === 'registrations' ?
            <div className="mb-4 flex gap-2 overflow-x-auto c2k-no-scrollbar" role="tablist" aria-label="Registration tabs">
              {(['upcoming', 'pending', 'past'] as const).map((tab) => (
                <TabButton key={tab} active={regTab === tab} onClick={() => setRegTab(tab)}>
                  {tab === 'upcoming' ? 'Upcoming' : tab === 'pending' ? 'Pending' : 'Past'}
                </TabButton>
              ))}
            </div>
          : null}

          {mode === 'hosted' ?
            <div className="mb-4 flex gap-2 overflow-x-auto c2k-no-scrollbar" role="tablist" aria-label="Hosted event tabs">
              {(['upcoming', 'drafts', 'staffed', 'past'] as const).map((tab) => (
                <TabButton key={tab} active={hostedTab === tab} onClick={() => setHostedTab(tab)}>
                  {tab === 'upcoming' ? 'Upcoming' : tab === 'drafts' ? 'Drafts' : tab === 'staffed' ? 'Staffed' : 'Past'}
                </TabButton>
              ))}
            </div>
          : null}

          {renderFilterControls()}

          {mode === 'saved' ?
            renderSavedBody()
          : mode === 'hosted' ?
            renderHostedBody()
          : renderRegistrationsBody()}
    </DirectoryTemplate>
  )
}
