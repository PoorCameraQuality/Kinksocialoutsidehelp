import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { type ScheduleLayout } from '@/components/conventions/ConventionScheduleAgenda'
import ConventionAttendeeHubShell from '@/components/conventions/ConventionAttendeeHubShell'
import DancecardOpsCard from '@/components/conventions/DancecardOpsCard'
import ConventionDancecardOrganizerClient from '@/components/organizer/convention/ConventionDancecardOrganizerClient'
import ConventionHero, {
  formatConventionDateRange,
  type ConventionHeroPreviewRole,
} from '@/components/conventions/ConventionHero'
import RegisterToUnlockCard from '@/components/conventions/RegisterToUnlockCard'
import ConventionWelcomePanel from '@/app/conventions/[slug]/panels/ConventionWelcomePanel'
import ConventionProgramSchedulePanel, {
  ConventionScheduleLockedPanel,
} from '@/app/conventions/[slug]/panels/ConventionProgramSchedulePanel'
import ConventionManageNav from '@/app/conventions/[slug]/panels/ConventionManageNav'
import ConventionHubChannelsAdmin from '@/app/conventions/[slug]/panels/ConventionHubChannelsAdmin'
import {
  useConventionHub,
  type ConventionSettings,
  type ConvRow,
} from '@/hooks/useConventionHub'
import ChannelComposer from '@/components/conventions/ChannelComposer'
import ChannelMessageList from '@/components/conventions/ChannelMessageList'
import VenueMapsList from '@/components/conventions/VenueMapsList'
import ConventionGalleryGrid from '@/components/conventions/ConventionGalleryGrid'
import ConventionEventSidebar from '@/components/conventions/ConventionEventSidebar'
import ConventionPublishedPoliciesPanel from '@/components/conventions/ConventionPublishedPoliciesPanel'
import MobileActionBar from '@/components/shell/MobileActionBar'
import {
  buildOfficialLinks,
  plainConventionText,
  truncateHeroSummary,
} from '@/lib/convention-description'
import {
  dancecardEmbedScheduleUrl,
  isDancecardLinked,
} from '@/lib/dancecardIntegration'
import type { ScheduleSlot } from '@/components/conventions/convention-schedule-types'
import TabButton from '../../../components/ui/TabButton'
import ScopePageMeta from '@/components/seo/ScopePageMeta'
import { useTabFromUrl } from '@/hooks/useTabFromUrl'
import { useConfirm } from '@/hooks/useConfirm'

type Slot = ScheduleSlot

const VENUE_LABELS: Record<string, string> = {
  single_venue: 'Single venue',
  hotel_takeover: 'Hotel takeover',
  camping: 'Camping / outdoor',
  urban_multi_venue: 'Multi-venue (urban)',
  other: 'Other',
}

type LogisticsIconName = 'venue' | 'hotel' | 'shield' | 'siren' | 'accessibility'

function LogisticsIcon({ name }: { name: LogisticsIconName }) {
  const base = 'h-4 w-4'
  switch (name) {
    case 'venue':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'hotel':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path
            d="M3 21V8h18v13M3 13h18M7 13V8m4 5V8m4 5V8m4 5V8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'shield':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'siren':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path
            d="M7 17v-5a5 5 0 0 1 10 0v5M5 21h14M4 13l-2 1m20-1 2 1M12 4V2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'accessibility':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <circle cx={12} cy={4} r={2} />
          <path
            d="M9 11h6l-1 5h2l1.5 4M12 11v3l-2 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}

function LogisticsCard({
  icon,
  label,
  span = 1,
  children,
}: {
  icon: LogisticsIconName
  label: string
  span?: 1 | 2
  children: React.ReactNode
}) {
  return (
    <div
      className={`group rounded-2xl border border-dc-border bg-dc-elevated-solid p-6 transition hover:border-dc-accent-border/40 ${
        span === 2 ? 'sm:col-span-2' : ''
      }`}
    >
      <div className="flex items-center gap-2 text-dc-muted">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-dc-elevated-muted text-dc-accent ring-1 ring-white/10"
          style={{ color: 'var(--event-accent, currentColor)' }}
        >
          <LogisticsIcon name={icon} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function hasLogisticsContent(settings: ConventionSettings | null | undefined): boolean {
  if (!settings || typeof settings !== 'object') return false
  const blocks = settings.hotelBlocks?.filter((b) => b.label?.trim())
  return Boolean(
    settings.venueProfile ||
      (blocks && blocks.length > 0) ||
      settings.cocUrl ||
      settings.safetyReportingNote ||
      settings.accessibilityVenueNotes,
  )
}

function LogisticsCards({ settings }: { settings: ConventionSettings | null | undefined }) {
  if (!hasLogisticsContent(settings) || !settings) return null
  const blocks = settings.hotelBlocks?.filter((b) => b.label?.trim())
  return (
    <section className="grid gap-3 sm:grid-cols-2" aria-label="Convention logistics">
      {settings.venueProfile && (
        <LogisticsCard icon="venue" label="Venue">
          <p className="text-sm text-dc-text">{VENUE_LABELS[settings.venueProfile] ?? settings.venueProfile}</p>
        </LogisticsCard>
      )}
      {blocks && blocks.length > 0 && (
        <LogisticsCard icon="hotel" label="Hotel & lodging" span={settings.venueProfile ? 1 : 2}>
          <ul className="space-y-2 text-sm text-dc-text-muted">
            {blocks.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-dc-text font-medium">{b.label}</span>
                {b.code && (
                  <span className="rounded-md border border-dc-border bg-dc-elevated-muted px-1.5 py-0.5 font-mono text-xs">
                    {b.code}
                  </span>
                )}
                {b.url && (
                  <a
                    href={b.url}
                    className="text-dc-accent hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Book &rarr;
                  </a>
                )}
              </li>
            ))}
          </ul>
        </LogisticsCard>
      )}
      {settings.cocUrl && (
        <LogisticsCard icon="shield" label="Code of conduct">
          <a
            href={settings.cocUrl}
            className="inline-flex items-center gap-1 text-sm font-medium text-dc-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Read code of conduct
            <span aria-hidden>&rarr;</span>
          </a>
        </LogisticsCard>
      )}
      {settings.safetyReportingNote && (
        <LogisticsCard icon="siren" label="Safety & incidents" span={2}>
          <p className="text-sm text-dc-text-muted whitespace-pre-wrap">{settings.safetyReportingNote}</p>
        </LogisticsCard>
      )}
      {settings.accessibilityVenueNotes && (
        <LogisticsCard icon="accessibility" label="Venue accessibility" span={2}>
          <p className="text-sm text-dc-text-muted whitespace-pre-wrap">{settings.accessibilityVenueNotes}</p>
        </LogisticsCard>
      )}
    </section>
  )
}

type MainTab =
  | 'Welcome'
  | 'Documents'
  | 'Announcements'
  | 'Chat'
  | 'ISO'
  | 'Schedule'
  | 'Dancecard'
  | 'More'

const CONVENTION_MAIN_TABS: readonly MainTab[] = [
  'Welcome',
  'Documents',
  'Announcements',
  'Chat',
  'ISO',
  'Schedule',
  'Dancecard',
  'More',
] as const

/** Visible peer tabs; Documents / ISO / Dancecard live under More. */
const CONVENTION_PRIMARY_TABS: readonly MainTab[] = [
  'Welcome',
  'Schedule',
  'Announcements',
  'Chat',
  'More',
]

function isOverflowTab(tab: string, allTabs: readonly MainTab[]): boolean {
  return allTabs.includes(tab as MainTab) && !CONVENTION_PRIMARY_TABS.includes(tab as MainTab)
}

function tabDisplayLabel(tab: MainTab): string {
  switch (tab) {
    case 'Welcome':
      return 'About'
    case 'Chat':
      return 'Discussion'
    default:
      return tab
  }
}

function isManageSuccessMessage(message: string) {
  return (
    message.startsWith('Saved') ||
    message.startsWith('Staff duty added.') ||
    message.startsWith('Staff duty removed.') ||
    message.startsWith('Volunteer shift added.') ||
    message.startsWith('Cloned.')
  )
}

export default function ConventionProgramPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const organizerOrgSlug = searchParams.get('organizerOrg')?.trim() || null
  const organizerMode = !!organizerOrgSlug
  const manageTabParam = searchParams.get('tab')
  const manageTabRequested =
    manageTabParam === 'Manage' || manageTabParam?.toLowerCase() === 'manage'
  const hub = useConventionHub({
    slug,
    previewRoleQuery: searchParams.get('previewRole'),
  })
  const {
    key,
    conv,
    setConv,
    organizationSummary,
    isPinned,
    setIsPinned,
    anchorEventSummary,
    slots,
    setSlots,
    docs,
    pages,
    access,
    contributorsPreview,
    logisticsDraft,
    setLogisticsDraft,
    scheduleRevision,
    setScheduleRevision,
    myScheduleItems,
    hubChannelsMode,
    channelIds,
    selectedChannelId,
    setSelectedChannelId,
    err,
    convLoadAttempted,
    retryLoad,
    reloadProgramSlices,
    reloadSlotsOnly,
    reloadMySchedule,
    slotsByDay,
    eventSystems,
    themeVars,
    themeAccent,
    attendeeGuide,
    attendeeOk,
    scheduleOpen,
    settings: dancecardSettings,
  } = hub
  const programLayout = useMemo((): ScheduleLayout => {
    return searchParams.get('programView') === 'list' ? 'time-list' : 'cards'
  }, [searchParams])
  const onProgramLayoutChange = useCallback(
    (next: ScheduleLayout) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next === 'time-list') p.set('programView', 'list')
          else p.delete('programView')
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  const [dancecardReloadKey, setDancecardReloadKey] = useState(0)
  const [hubActionNotice, setHubActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [channelMessages, setChannelMessages] = useState<
    Array<{
      id: string
      body: string
      username: string | null
      parentMessageId?: string | null
      reactions?: Record<string, number>
    }>
  >([])
  const [channelMessagesLoadError, setChannelMessagesLoadError] = useState<string | null>(null)
  const [channelMessagesReloadKey, setChannelMessagesReloadKey] = useState(0)
  const [channelFetchFailed, setChannelFetchFailed] = useState(false)
  const [channelUnread, setChannelUnread] = useState<Record<string, number>>({})
  const [tab, setTab] = useTabFromUrl(CONVENTION_MAIN_TABS, 'Schedule')
  const selectTab = useCallback(
    (nextTab: string) => {
      setTab(nextTab)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', nextTab)
          return p
        },
        { replace: false },
      )
    },
    [setTab, setSearchParams],
  )
  const { isAuthenticated } = useAuth()
  type IsoBoardRow = {
    userId: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    body: string
    acceptDmsViaIso: boolean
    images: { sortOrder: number; url: string }[]
    staffRemoved: boolean
  }
  const [isoBoard, setIsoBoard] = useState<{ boardEnabled: boolean; items: IsoBoardRow[]; canManage: boolean } | null>(null)
  const [isoListed, setIsoListed] = useState<boolean | null>(null)
  const [isoBoardLoading, setIsoBoardLoading] = useState(false)
  const [isoBoardLoadError, setIsoBoardLoadError] = useState<string | null>(null)
  const [isoBoardLoadAttempted, setIsoBoardLoadAttempted] = useState(false)
  const [isoRefreshKey, setIsoRefreshKey] = useState(0)
  const [manageMsg, setManageMsg] = useState<string | null>(null)
  const [cloneSlug, setCloneSlug] = useState('')
  const [volunteerShifts, setVolunteerShifts] = useState<
    Array<{
      id: string
      title: string
      startsAt: string
      endsAt: string
      location: string | null
      signupCount?: number
    }>
  >([])
  const [newVolunteerShift, setNewVolunteerShift] = useState({
    title: '',
    startsAt: '',
    endsAt: '',
    location: '',
  })
  const [standaloneStaffDuties, setStandaloneStaffDuties] = useState<
    Array<{
      id: string
      userId: string
      roleLabel: string
      station: string | null
      location: string | null
      notes: string | null
      startsAt: string
      endsAt: string
    }>
  >([])
  const [newStaffDuty, setNewStaffDuty] = useState({
    userId: '',
    roleLabel: 'Floater',
    station: '',
    location: '',
    notes: '',
    startsAt: '',
    endsAt: '',
  })
  const [staffRoster, setStaffRoster] = useState<
    Array<{
      userId: string
      username: string
      displayName: string | null
      avatarUrl: string | null
      roles: string[]
      nextStartsAt: string | null
      nextLabel: string | null
      canAssignStaffSchedules?: boolean
    }>
  >([])
  const [crewGridDays, setCrewGridDays] = useState<
    Array<{
      dayKey: string
      dayLabel: string
      buckets: Array<{ start: string; end: string }>
      rows: Array<{ userId: string; username: string; displayName: string | null; cells: (string | null)[] }>
    }>
  >([])
  const [newDoc, setNewDoc] = useState<{
    title: string
    url: string
    type: string
    visibility: 'ATTENDEE' | 'STAFF' | 'PUBLIC'
  }>({ title: '', url: '', type: 'general', visibility: 'ATTENDEE' })
  const [newPage, setNewPage] = useState<{
    slug: string
    title: string
    visibility: 'ATTENDEE' | 'STAFF' | 'PUBLIC'
  }>({ slug: '', title: '', visibility: 'ATTENDEE' })
  const registerHref = slug ? `/conventions/${encodeURIComponent(slug)}/register` : '/'
  const manageOrgSlug = organizerOrgSlug ?? organizationSummary?.slug ?? null
  const manageOrgLabel = organizationSummary?.displayName ?? manageOrgSlug ?? 'Organization'

  useEffect(() => {
    if (!conv?.id) return
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/api/ws`)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', scope: `convention:${conv.id}:schedule` }))
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { type?: string; eventType?: string }
        if (msg.type === 'event' && String(msg.eventType ?? '').includes('schedule')) {
          void reloadSlotsOnly()
          void reloadMySchedule()
          setDancecardReloadKey((k) => k + 1)
        }
      } catch {
        /* ignore */
      }
    }
    return () => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  }, [conv?.id, reloadSlotsOnly, reloadMySchedule])

  useEffect(() => {
    if (!slug || !scheduleRevision) return
    const t = window.setInterval(() => {
      void (async () => {
        const k = encodeURIComponent(slug)
        const r = await fetch(`/api/v1/conventions/${k}/slots`, { credentials: 'include' })
        if (!r.ok) return
        const d = (await r.json()) as { scheduleRevision?: string; items: Slot[] }
        if (d.scheduleRevision && d.scheduleRevision !== scheduleRevision) {
          setSlots(d.items)
          setScheduleRevision(d.scheduleRevision)
          void reloadMySchedule()
        }
      })()
    }, 45_000)
    return () => window.clearInterval(t)
  }, [slug, scheduleRevision, reloadMySchedule])

  useEffect(() => {
    if (!slug || !attendeeOk || tab !== 'Schedule') return
    void reloadMySchedule()
  }, [slug, attendeeOk, tab, reloadMySchedule])

  useEffect(() => {
    if (!slug || !manageTabRequested || !(access?.canManage || access?.isStaff)) return
    let cancelled = false
    void (async () => {
      const k = encodeURIComponent(slug)
      const r = await fetch(`/api/v1/conventions/${k}/staff-duties`, { credentials: 'include' })
      if (!r.ok || cancelled) return
      const d = (await r.json()) as { items: typeof standaloneStaffDuties }
      setStandaloneStaffDuties(d.items ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [slug, manageTabRequested, access?.canManage, access?.isStaff])

  useEffect(() => {
    if (!slug || !manageTabRequested || !(access?.canManage || access?.isStaff)) return
    let cancelled = false
    void (async () => {
      const k = encodeURIComponent(slug)
      const [r1, r2] = await Promise.all([
        fetch(`/api/v1/conventions/${k}/staff-roster`, { credentials: 'include' }),
        fetch(`/api/v1/conventions/${k}/crew-grid`, { credentials: 'include' }),
      ])
      if (cancelled) return
      if (r1.ok) {
        const d = (await r1.json()) as { items: typeof staffRoster }
        setStaffRoster(d.items ?? [])
      }
      if (r2.ok) {
        const d = (await r2.json()) as { days: typeof crewGridDays }
        setCrewGridDays(d.days ?? [])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, manageTabRequested, access?.canManage, access?.isStaff])

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    void navigator.serviceWorker.register('/sw-program.js').catch(() => {
      /* ignore */
    })
  }, [])

  useEffect(() => {
    if (manageTabRequested && access && !access.canManage && !access.isStaff) setTab('Schedule')
  }, [manageTabRequested, access, setTab])

  useEffect(() => {
    if (tab !== 'ISO' || !slug || !access?.canView) return
    let cancelled = false
    void (async () => {
      setIsoBoardLoading(true)
      setIsoBoardLoadError(null)
      try {
        const r = await fetch(`/api/v1/conventions/${key}/iso-board`, { credentials: 'include' })
        if (cancelled) return
        if (!r.ok) {
          setIsoBoard(null)
          setIsoBoardLoadError('Could not load the ISO board.')
          return
        }
        const d = (await r.json()) as { boardEnabled: boolean; items: IsoBoardRow[]; canManage: boolean }
        setIsoBoard(d)
        if (isAuthenticated && !cancelled) {
          const rm = await fetch(`/api/v1/conventions/${key}/iso-board/me`, { credentials: 'include' })
          if (rm.ok && !cancelled) {
            const me = (await rm.json()) as { listed?: boolean }
            setIsoListed(Boolean(me.listed))
          } else if (!cancelled) setIsoListed(null)
        } else if (!cancelled) setIsoListed(null)
      } catch {
        if (!cancelled) {
          setIsoBoard(null)
          setIsoBoardLoadError('Network error loading the ISO board.')
        }
      } finally {
        if (!cancelled) {
          setIsoBoardLoading(false)
          setIsoBoardLoadAttempted(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, slug, key, access?.canView, isAuthenticated, isoRefreshKey])

  useEffect(() => {
    if (!manageTabRequested || !access?.canManage || !slug) return
    let cancelled = false
    void (async () => {
      const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/volunteer-shifts`, {
        credentials: 'include',
      })
      if (!r.ok || cancelled) return
      const d = (await r.json()) as {
        items: Array<{
          id: string
          title: string
          startsAt: string
          endsAt: string
          location: string | null
          signupCount?: number
        }>
      }
      setVolunteerShifts(d.items ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [manageTabRequested, access?.canManage, slug])

  useEffect(() => {
    if (!selectedChannelId) return
    if (!hubChannelsMode && !conv?.organizationId) return
    let cancelled = false
    const messagesUrl =
      hubChannelsMode && slug ?
        `/api/v1/conventions/${encodeURIComponent(slug)}/hub-channels/${selectedChannelId}/messages`
      : conv?.organizationId ?
        `/api/v1/organizations/${encodeURIComponent(conv.organizationId)}/channels/${selectedChannelId}/messages?forConventionId=${encodeURIComponent(conv.id)}`
      : null
    if (!messagesUrl) return
    ;(async () => {
      setChannelMessagesLoadError(null)
      try {
        const r = await fetch(messagesUrl, { credentials: 'include' })
        if (cancelled) return
        if (!r.ok) {
          setChannelMessages([])
          setChannelFetchFailed(true)
          setChannelMessagesLoadError('Could not load channel messages.')
          return
        }
        setChannelFetchFailed(false)
        const d = (await r.json()) as {
          items: Array<{
            id: string
            body: string
            username?: string
            parentMessageId?: string | null
            sender?: { username?: string }
            reactions?: Record<string, number>
          }>
        }
        setChannelMessages(
          (d.items ?? []).map((m) => ({
            id: m.id,
            body: m.body,
            username: m.username ?? m.sender?.username ?? null,
            parentMessageId: m.parentMessageId,
            reactions: m.reactions,
          })),
        )
      } catch {
        if (!cancelled) {
          setChannelMessages([])
          setChannelFetchFailed(true)
          setChannelMessagesLoadError('Network error loading channel messages.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hubChannelsMode, conv?.organizationId, selectedChannelId, channelMessagesReloadKey, conv?.id, slug])

  const reloadChannelMessages = useCallback(async () => {
    if (!selectedChannelId) return
    const messagesUrl =
      hubChannelsMode && slug ?
        `/api/v1/conventions/${encodeURIComponent(slug)}/hub-channels/${selectedChannelId}/messages`
      : conv?.organizationId ?
        `/api/v1/organizations/${encodeURIComponent(conv.organizationId)}/channels/${selectedChannelId}/messages?forConventionId=${encodeURIComponent(conv.id)}`
      : null
    if (!messagesUrl) return
    const r = await fetch(messagesUrl, { credentials: 'include' })
    if (!r.ok) return
    const d = (await r.json()) as {
      items: Array<{
        id: string
        body: string
        username?: string
        parentMessageId?: string | null
        sender?: { username?: string }
        reactions?: Record<string, number>
      }>
    }
    setChannelMessages(
      (d.items ?? []).map((m) => ({
        id: m.id,
        body: m.body,
        username: m.username ?? m.sender?.username ?? null,
        parentMessageId: m.parentMessageId,
        reactions: m.reactions,
      })),
    )
  }, [hubChannelsMode, conv?.organizationId, conv?.id, selectedChannelId, slug])

  useEffect(() => {
    if (!slug || !selectedChannelId || !attendeeOk) return
    if (tab !== 'Chat' && tab !== 'Announcements') return
    const markReadUrl =
      hubChannelsMode ?
        `/api/v1/conventions/${encodeURIComponent(slug)}/hub-channels/${selectedChannelId}/mark-read`
      : conv?.id ?
        `/api/v1/conventions/${encodeURIComponent(slug)}/channels/${selectedChannelId}/mark-read`
      : null
    if (!markReadUrl) return
    void fetch(markReadUrl, { method: 'POST', credentials: 'include' }).then(() => {
      if (hubChannelsMode && selectedChannelId) {
        setChannelUnread((prev) => ({ ...prev, [selectedChannelId]: 0 }))
      }
    })
  }, [slug, conv?.id, selectedChannelId, tab, attendeeOk, hubChannelsMode])

  useEffect(() => {
    if (!hubChannelsMode || !slug || !isAuthenticated) return
    let cancelled = false
    void (async () => {
      const next: Record<string, number> = {}
      await Promise.all(
        channelIds.map(async (c) => {
          try {
            const r = await fetch(
              `/api/v1/conventions/${encodeURIComponent(slug)}/hub-channels/${encodeURIComponent(c.id)}/unread-count`,
              { credentials: 'include' },
            )
            if (!r.ok) return
            const d = (await r.json()) as { unreadCount?: number }
            next[c.id] = Number(d.unreadCount ?? 0)
          } catch {
            /* ignore */
          }
        }),
      )
      if (!cancelled) setChannelUnread(next)
    })()
    return () => {
      cancelled = true
    }
  }, [hubChannelsMode, slug, isAuthenticated, channelIds, channelMessagesReloadKey, tab])

  useEffect(() => {
    if (hubChannelsMode) return
    if (!conv?.organizationId || !selectedChannelId) return
    if (tab !== 'Chat' && tab !== 'Announcements') return
    const ch = channelIds.find((c) => c.id === selectedChannelId)
    if (!ch || (ch.kind !== 'TEXT' && ch.kind !== 'ANNOUNCEMENTS')) return
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/api/ws`)
    ws.onopen = () => {
      ws.send(
        JSON.stringify({ type: 'subscribe', scope: `org:${conv.organizationId}:channel:${selectedChannelId}` }),
      )
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { type?: string; eventType?: string }
        if (msg.type === 'event' && String(msg.eventType ?? '').startsWith('org_channel')) {
          void reloadChannelMessages()
        }
      } catch {
        /* ignore */
      }
    }
    return () => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  }, [conv?.organizationId, selectedChannelId, tab, channelIds, reloadChannelMessages])

  const staffCanOpenOrganizer = !!(access?.canManage || access?.isStaff) && !!organizationSummary?.slug
  const organizerConventionHref =
    staffCanOpenOrganizer && slug ?
      `/organizer/orgs/${encodeURIComponent(organizationSummary!.slug)}/conventions/${encodeURIComponent(slug)}`
    : null

  // Command Bridge → Hero wiring
  const heroEyebrow = (eventSystems?.productTitle?.trim() || null) ?? 'Convention'
  const heroTitle = eventSystems?.eventTitle?.trim() || conv?.name || '\u2026'
  const fullDescription = conv?.description?.trim() || null
  const heroSummarySource =
    eventSystems?.sharedByDetail?.trim() ||
    eventSystems?.sharedByLabel?.trim() ||
    fullDescription ||
    null
  const heroSummary = truncateHeroSummary(heroSummarySource) || null
  const hasFullDescription = Boolean(plainConventionText(fullDescription))
  const heroLogo = eventSystems?.logoUrl?.trim() || null
  const locationLabel =
    anchorEventSummary?.locationLabel?.trim() ||
    conv?.settings?.eckeListing?.venueName?.trim() ||
    null
  const dateLabel = formatConventionDateRange(
    conv?.startsAt ?? null,
    conv?.endsAt ?? null,
    conv?.timezone ?? null,
  )
  const officialLinks = useMemo(
    () =>
      buildOfficialLinks({
        description: fullDescription,
        websiteUrl: conv?.settings?.eckeListing?.websiteUrl,
        cocUrl: conv?.settings?.cocUrl,
        hotelBlocks: conv?.settings?.hotelBlocks,
        ticketingUrl: attendeeGuide?.ticketingUrl,
      }),
    [
      fullDescription,
      conv?.settings?.eckeListing?.websiteUrl,
      conv?.settings?.cocUrl,
      conv?.settings?.hotelBlocks,
      attendeeGuide?.ticketingUrl,
    ],
  )

  const whyGoHighlights = useMemo(() => {
    const fromListing = (conv?.settings?.eckeListing?.highlights ?? [])
      .map((h) => h.trim())
      .filter(Boolean)
    if (fromListing.length) return fromListing
    const fallback: string[] = []
    const profile = conv?.settings?.venueProfile
    if (profile === 'hotel_takeover') {
      fallback.push('Hotel takeover weekend with programming across event spaces')
    } else if (profile === 'camping') {
      fallback.push('Outdoor / camping setting with community programming')
    } else if (profile) {
      fallback.push(VENUE_LABELS[profile] ?? profile)
    }
    if (conv?.settings?.hotelBlocks?.some((b) => b.url)) {
      fallback.push('Hotel block available for attendees')
    }
    if (attendeeGuide?.ticketingUrl || officialLinks.some((l) => l.kind === 'registration')) {
      fallback.push('Online registration with organizer-managed ticketing')
    }
    if (officialLinks.some((l) => l.kind === 'fetlife' || l.kind === 'discord')) {
      fallback.push('Active community channels for updates and connection')
    }
    return fallback.slice(0, 4)
  }, [conv?.settings, attendeeGuide?.ticketingUrl, officialLinks])

  const tabLabels: MainTab[] = useMemo(() => {
    return ['Welcome', 'Schedule', 'Announcements', 'Chat', 'Documents', 'ISO', 'Dancecard', 'More']
  }, [])

  const togglePin = useCallback(async () => {
    if (!slug) return
    const method = isPinned ? 'DELETE' : 'POST'
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/pin`, {
      method,
      credentials: 'include',
    })
    if (r.ok) setIsPinned(!isPinned)
  }, [slug, isPinned, setIsPinned])

  // Preview-role gating: organizer/staff only
  const rawPreviewRole = searchParams.get('previewRole')?.trim().toLowerCase() ?? null
  const validPreviewRole = (['attendee', 'staff', 'safety', 'public'] as const).find((r) => r === rawPreviewRole) ?? null
  const previewRole: ConventionHeroPreviewRole | null =
    validPreviewRole && (access?.canManage || access?.isStaff) ? validPreviewRole : null
  const hubAccessOk =
    Boolean(access?.hasPaidAccess || access?.isStaff || access?.canManage) ||
    previewRole === 'attendee' ||
    previewRole === 'staff' ||
    previewRole === 'safety'
  const exitPreview = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.delete('previewRole')
        return p
      },
      { replace: true },
    )
  }, [setSearchParams])

  const dancecardLinked = isDancecardLinked(dancecardSettings)
  const embedScheduleUrl =
    dancecardSettings?.dancecardEmbedTokenHint?.trim() ?
      dancecardEmbedScheduleUrl(dancecardSettings, dancecardSettings.dancecardEmbedTokenHint!.trim(), {
        chrome: 'minimal',
      })
    : null

  useEffect(() => {
    if (organizerMode && manageOrgSlug && slug) {
      navigate(
        `/organizer/orgs/${encodeURIComponent(manageOrgSlug)}/conventions/${encodeURIComponent(slug)}`,
        { replace: true },
      )
    }
  }, [organizerMode, manageOrgSlug, slug, navigate])

  useEffect(() => {
    if (!(tabLabels as readonly string[]).includes(tab)) {
      setTab(tabLabels[0] ?? 'Schedule')
    }
  }, [tabLabels, tab, setTab])

  useEffect(() => {
    const orgSlug = manageOrgSlug ?? organizationSummary?.slug
    if (!slug || !orgSlug) return
    const raw = searchParams.get('tab')
    if (raw === 'Manage' || raw?.toLowerCase() === 'manage') {
      if (access?.canManage || access?.isStaff) {
        navigate(
          `/organizer/orgs/${encodeURIComponent(orgSlug)}/conventions/${encodeURIComponent(slug)}`,
          { replace: true },
        )
      }
    }
  }, [searchParams, slug, manageOrgSlug, organizationSummary?.slug, access?.canManage, access?.isStaff, navigate])

  useEffect(() => {
    if (organizerMode || !conv) return
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const wantsParticipate = hash === '#get-involved' || searchParams.get('participate') === '1'
    if (!wantsParticipate) return
    const t = window.setTimeout(() => {
      document.getElementById('get-involved')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [conv, organizerMode, searchParams])

  useEffect(() => {
    if (!manageMsg || !isManageSuccessMessage(manageMsg)) return
    const timer = window.setTimeout(() => setManageMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [manageMsg])

  if (err) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div
          className="rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <p className="flex-1">{err}</p>
            <button
              type="button"
              onClick={retryLoad}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Retry
            </button>
          </div>
        </div>
        <div className="mt-4 text-center">
          <Link to="/orgs" className="text-dc-accent hover:underline">
            Browse organizations
          </Link>
        </div>
      </div>
    )
  }

  if (!conv && convLoadAttempted && !err) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-xl border border-dc-border bg-dc-elevated/80 px-4 py-3 text-sm text-dc-muted">
          <p>Convention unavailable.</p>
          <button
            type="button"
            onClick={retryLoad}
            className="mt-2 min-h-10 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            Retry
          </button>
        </div>
        <div className="mt-4 text-center">
          <Link to="/orgs" className="text-dc-accent hover:underline">
            Browse organizations
          </Link>
        </div>
      </div>
    )
  }

  async function addSlotToDancecard(slotId: string) {
    if (!slug) return
    setHubActionNotice(null)
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/slots/${encodeURIComponent(slotId)}/signup`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setHubActionNotice({
        type: 'error',
        text: j.error ?? (r.status === 403 ? 'Register for this convention to add sessions.' : 'Could not add to dancecard.'),
      })
      return
    }
    const d = (await r.json().catch(() => ({}))) as { conflict?: boolean }
    setHubActionNotice({
      type: 'success',
      text: d.conflict ? 'Added to dancecard (overlaps another commitment. Check My availability).' : 'Added to your dancecard.',
    })
    setDancecardReloadKey((k) => k + 1)
    await reloadSlotsOnly()
    await reloadMySchedule()
  }

  async function updateStaffAssignPermission(userId: string, canAssignStaffSchedules: boolean) {
    if (!slug) return
    const r = await fetch(
      `/api/v1/conventions/${encodeURIComponent(slug)}/access/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canAssignStaffSchedules }),
      },
    )
    if (!r.ok) return
    setStaffRoster((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, canAssignStaffSchedules } : p)),
    )
  }

  async function submitNewStaffDuty() {
    if (!slug || !newStaffDuty.userId.trim() || !newStaffDuty.startsAt || !newStaffDuty.endsAt) {
      setManageMsg('Staff duty needs user UUID, start, and end.')
      return
    }
    setManageMsg(null)
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/staff-duties`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: newStaffDuty.userId.trim(),
        roleLabel: newStaffDuty.roleLabel.trim() || 'staff',
        station: newStaffDuty.station.trim() || undefined,
        location: newStaffDuty.location.trim() || undefined,
        notes: newStaffDuty.notes.trim() || undefined,
        startsAt: new Date(newStaffDuty.startsAt).toISOString(),
        endsAt: new Date(newStaffDuty.endsAt).toISOString(),
      }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setManageMsg(j.error ?? 'Could not create staff duty')
      return
    }
    setNewStaffDuty({ userId: '', roleLabel: 'Floater', station: '', location: '', notes: '', startsAt: '', endsAt: '' })
    const lr = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/staff-duties`, { credentials: 'include' })
    if (lr.ok) {
      const d = (await lr.json()) as { items: typeof standaloneStaffDuties }
      setStandaloneStaffDuties(d.items ?? [])
    }
    setManageMsg('Staff duty added.')
    await reloadMySchedule()
  }

  async function deleteStaffDuty(id: string) {
    if (!slug || !(await confirm('Delete this staff duty?', 'This removes the duty from the program.', { destructive: true }))) return
    setManageMsg(null)
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/staff-duties/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setManageMsg(j.error ?? 'Could not delete')
      return
    }
    setStandaloneStaffDuties((prev) => prev.filter((x) => x.id !== id))
    setManageMsg('Staff duty removed.')
    await reloadMySchedule()
  }

  async function submitNewDoc() {
    if (!slug || !newDoc.title.trim() || !newDoc.url.trim()) {
      setManageMsg('Document needs title and URL.')
      return
    }
    setManageMsg(null)
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/documents`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newDoc.title.trim(),
        url: newDoc.url.trim(),
        type: newDoc.type || 'general',
        visibility: newDoc.visibility,
      }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setManageMsg(j.error ?? 'Could not add document')
      return
    }
    setNewDoc({ title: '', url: '', type: 'general', visibility: 'ATTENDEE' })
    await reloadProgramSlices()
  }

  async function deleteDoc(id: string) {
    if (!slug || !(await confirm('Remove this document?', 'Attendees will no longer see this file.', { destructive: true }))) return
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/documents/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setManageMsg(j.error ?? 'Could not delete')
      return
    }
    await reloadProgramSlices()
  }

  async function submitNewPage() {
    if (!slug || !newPage.slug.trim() || !newPage.title.trim()) {
      setManageMsg('Custom page needs slug and title.')
      return
    }
    setManageMsg(null)
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/custom-pages`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: newPage.slug.trim().toLowerCase(),
        title: newPage.title.trim(),
        visibility: newPage.visibility,
        content: { body: '' },
      }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setManageMsg(j.error ?? 'Could not add page')
      return
    }
    setNewPage({ slug: '', title: '', visibility: 'ATTENDEE' })
    await reloadProgramSlices()
  }

  async function deletePage(id: string) {
    if (!slug || !(await confirm('Delete this custom page?', 'This page will be removed from the hub.', { destructive: true }))) return
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/custom-pages/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setManageMsg(j.error ?? 'Could not delete')
      return
    }
    await reloadProgramSlices()
  }

  async function saveLogistics() {
    if (!slug) return
    setManageMsg(null)
    let hotelBlocks: ConventionSettings['hotelBlocks']
    if (logisticsDraft.hotelBlocksText.trim()) {
      try {
        const parsed = JSON.parse(logisticsDraft.hotelBlocksText) as unknown
        if (!Array.isArray(parsed)) throw new Error('not array')
        hotelBlocks = parsed as ConventionSettings['hotelBlocks']
      } catch {
        setManageMsg('Hotel blocks must be valid JSON array, e.g. [{"label":"Hotel A","code":"CON"}]')
        return
      }
    }
    const settings: ConventionSettings = {}
    if (logisticsDraft.venueProfile) settings.venueProfile = logisticsDraft.venueProfile
    if (logisticsDraft.cocUrl.trim()) settings.cocUrl = logisticsDraft.cocUrl.trim()
    if (logisticsDraft.safetyReportingNote.trim()) settings.safetyReportingNote = logisticsDraft.safetyReportingNote.trim()
    if (logisticsDraft.accessibilityVenueNotes.trim())
      settings.accessibilityVenueNotes = logisticsDraft.accessibilityVenueNotes.trim()
    if (hotelBlocks && hotelBlocks.length > 0) settings.hotelBlocks = hotelBlocks
    settings.publicProgramListing = logisticsDraft.publicProgramListing
    const rolesRaw = logisticsDraft.programStaffAttendeeRolesText.trim()
    settings.programStaffAttendeeRoles = rolesRaw
      ? rolesRaw
          .split(/[,;\n]+/)
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 32)
      : []
    if (logisticsDraft.dancecardSlug.trim()) {
      settings.dancecardSlug = logisticsDraft.dancecardSlug.trim().toLowerCase()
      settings.dancecardEnabled = logisticsDraft.dancecardEnabled
    } else {
      settings.dancecardEnabled = false
    }
    if (logisticsDraft.dancecardHost.trim()) settings.dancecardHost = logisticsDraft.dancecardHost.trim()
    if (logisticsDraft.dancecardEmbedTokenHint.trim())
      settings.dancecardEmbedTokenHint = logisticsDraft.dancecardEmbedTokenHint.trim()
    settings.dancecardAttendeeSameTab = logisticsDraft.dancecardAttendeeSameTab

    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setManageMsg(j.error ?? 'Could not save logistics')
      return
    }
    const d = (await r.json()) as { convention: ConvRow }
    setConv(d.convention)
    setManageMsg('Saved logistics.')
  }

  async function submitVolunteerShift() {
    if (!slug || !newVolunteerShift.title.trim() || !newVolunteerShift.startsAt || !newVolunteerShift.endsAt) {
      setManageMsg('Volunteer shift needs title, start, and end.')
      return
    }
    setManageMsg(null)
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/volunteer-shifts`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newVolunteerShift.title.trim(),
        startsAt: new Date(newVolunteerShift.startsAt).toISOString(),
        endsAt: new Date(newVolunteerShift.endsAt).toISOString(),
        location: newVolunteerShift.location.trim() || undefined,
      }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setManageMsg(j.error ?? 'Could not create shift')
      return
    }
    setNewVolunteerShift({ title: '', startsAt: '', endsAt: '', location: '' })
    const lr = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/volunteer-shifts`, {
      credentials: 'include',
    })
    if (lr.ok) {
      const d = (await lr.json()) as { items: typeof volunteerShifts }
      setVolunteerShifts(d.items ?? [])
    }
    setManageMsg('Volunteer shift added.')
  }

  async function cloneConvention() {
    if (!slug || !cloneSlug.trim()) {
      setManageMsg('Enter a new slug for the clone.')
      return
    }
    setManageMsg(null)
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/clone`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newSlug: cloneSlug.trim().toLowerCase() }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setManageMsg(j.error ?? 'Clone failed')
      return
    }
    const d = (await r.json()) as { convention: { slug: string } }
    setManageMsg(`Cloned. Open /conventions/${encodeURIComponent(d.convention.slug)}`)
    setCloneSlug('')
  }

  const scheduleBlock =
    !scheduleOpen && tab === 'Schedule' ?
      <ConventionScheduleLockedPanel
        isAuthenticated={isAuthenticated}
        anchorEventId={conv?.anchorEventId ?? null}
        organization={organizationSummary}
      />
    : tab === 'Welcome' ?
      <div className="space-y-6">
        <ConventionWelcomePanel
          guide={attendeeGuide}
          conventionName={conv?.name ?? ''}
          conventionDescription={fullDescription}
          highlights={whyGoHighlights}
          officialLinks={officialLinks}
          venue={{
            locationLabel,
            venueLabel: conv?.settings?.venueProfile
              ? VENUE_LABELS[conv.settings.venueProfile] ?? conv.settings.venueProfile
              : null,
            venueName: conv?.settings?.eckeListing?.venueName ?? null,
            accessibilityNotes: conv?.settings?.accessibilityVenueNotes ?? null,
            hotelBlocks: conv?.settings?.hotelBlocks ?? null,
          }}
          logisticsSlot={
            !organizerMode && (conv?.settings?.cocUrl || conv?.settings?.safetyReportingNote) ?
              <LogisticsCards
                settings={{
                  cocUrl: conv?.settings?.cocUrl,
                  safetyReportingNote: conv?.settings?.safetyReportingNote,
                }}
              />
            : null
          }
        />
      </div>
    : !hubAccessOk && tab !== 'Schedule' ? (
      <RegisterToUnlockCard
        tab={tab}
        registerHref={registerHref}
        anchorEventId={conv?.anchorEventId}
        isAuthenticated={isAuthenticated}
      />
    ) : tab === 'Documents' ? (
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-dc-text">Documents</h2>
          {docs.length === 0 ? (
            <p className="text-dc-muted text-sm">No documents published yet.</p>
          ) : (
            docs.map((doc) => (
              <a
                key={doc.id}
                href={doc.url}
                className="block rounded-xl border border-dc-border bg-dc-elevated/95 p-4 hover:border-dc-accent-border/40"
              >
                <p className="font-medium text-dc-text">{doc.title}</p>
                <p className="text-xs uppercase tracking-wide text-dc-muted">{doc.type}</p>
              </a>
            ))
          )}
        </section>
        {slug ?
          <section className="space-y-3 border-t border-dc-border pt-8">
            <h2 className="text-lg font-semibold text-dc-text">Policies &amp; sign-off</h2>
            <p className="text-sm text-dc-muted">
              Published policies for this convention. Expand each policy to read and sign when required.
            </p>
            <ConventionPublishedPoliciesPanel conventionKey={slug} />
          </section>
        : null}
      </div>
    ) : tab === 'Announcements' || tab === 'Chat' ? (
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto">
          {channelIds
            .filter((c) =>
              tab === 'Announcements' ?
                c.kind === 'ANNOUNCEMENTS'
              : c.kind === 'CHAT' || c.kind === 'TEXT',
            )
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedChannelId(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs min-h-11 ${
                  selectedChannelId === c.id ? 'bg-dc-accent/20 text-dc-accent' : 'bg-dc-elevated-muted text-dc-text-muted'
                }`}
              >
                <span>#{c.name}</span>
                {hubChannelsMode && c.id !== selectedChannelId && (channelUnread[c.id] ?? 0) > 0 ?
                  <span className="rounded-full bg-dc-accent px-1.5 py-0.5 text-[10px] font-semibold text-dc-text">
                    {channelUnread[c.id]! > 99 ? '99+' : channelUnread[c.id]}
                  </span>
                : null}
              </button>
            ))}
        </div>
        {channelMessagesLoadError ?
          <div
            className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
            role="alert"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1">{channelMessagesLoadError}</p>
              <button
                type="button"
                onClick={() => setChannelMessagesReloadKey((k) => k + 1)}
                className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setChannelMessagesLoadError(null)}
                className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
              >
                Dismiss
              </button>
            </div>
          </div>
        : null}
        {channelFetchFailed && !channelMessagesLoadError ?
          <div className="rounded-xl border border-dc-border bg-dc-elevated/80 px-4 py-3 text-sm text-dc-muted">
            <p>Channel messages unavailable.</p>
            <button
              type="button"
              onClick={() => setChannelMessagesReloadKey((k) => k + 1)}
              className="mt-2 min-h-10 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Retry
            </button>
          </div>
        : !channelMessagesLoadError ?
          <>
            <ChannelMessageList
              messages={channelMessages}
              showReport={Boolean(hubChannelsMode && isAuthenticated)}
              onReact={
                !hubChannelsMode && conv?.organizationId && selectedChannelId ?
                  (messageId, kind) => {
                    void fetch(
                      `/api/v1/organizations/${encodeURIComponent(conv.organizationId!)}/channels/${selectedChannelId}/messages/${messageId}/reactions`,
                      {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ kind }),
                      },
                    ).then(() => reloadChannelMessages())
                  }
                : undefined
              }
              onReply={
                hubChannelsMode && slug && selectedChannelId ?
                  async (messageId, body) => {
                    const r = await fetch(
                      `/api/v1/conventions/${encodeURIComponent(slug)}/hub-channels/${selectedChannelId}/messages/${messageId}/replies`,
                      {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ body }),
                      },
                    )
                    if (!r.ok) {
                      const j = (await r.json().catch(() => ({}))) as { error?: string }
                      return { ok: false, error: j.error ?? 'Reply failed' }
                    }
                    await reloadChannelMessages()
                    return { ok: true }
                  }
                : undefined
              }
            />
            {(tab === 'Chat' || (tab === 'Announcements' && (access?.canManage || access?.isStaff))) &&
            selectedChannelId &&
            (hubChannelsMode || conv?.organizationId) ?
              <ChannelComposer
                placeholder={tab === 'Announcements' ? 'Broadcast to attendees…' : 'Message the channel…'}
                onSend={async (body) => {
                  const postUrl =
                    hubChannelsMode && slug ?
                      `/api/v1/conventions/${encodeURIComponent(slug)}/hub-channels/${selectedChannelId}/messages`
                    : conv?.organizationId ?
                      `/api/v1/organizations/${encodeURIComponent(conv.organizationId!)}/channels/${selectedChannelId}/messages`
                    : null
                  if (!postUrl) return { ok: false as const, error: 'Channel unavailable' }
                  const r = await fetch(postUrl, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ body }),
                  })
                  if (r.status === 429) {
                    const j = (await r.json().catch(() => ({}))) as { error?: string }
                    const m = /wait (\d+)s/i.exec(j.error ?? '')
                    return { ok: false as const, error: j.error ?? 'Slow mode', retryAfterSec: m ? Number(m[1]) : 30 }
                  }
                  if (!r.ok) {
                    const j = (await r.json().catch(() => ({}))) as { error?: string }
                    return { ok: false as const, error: j.error ?? 'Send failed' }
                  }
                  await reloadChannelMessages()
                  const markReadUrl =
                    hubChannelsMode && slug ?
                      `/api/v1/conventions/${encodeURIComponent(slug)}/hub-channels/${selectedChannelId}/mark-read`
                    : slug ?
                      `/api/v1/conventions/${encodeURIComponent(slug)}/channels/${selectedChannelId}/mark-read`
                    : null
                  if (markReadUrl) {
                    void fetch(markReadUrl, { method: 'POST', credentials: 'include' }).then(() => {
                      if (hubChannelsMode && selectedChannelId) {
                        setChannelUnread((prev) => ({ ...prev, [selectedChannelId]: 0 }))
                      }
                    })
                  }
                  return { ok: true as const }
                }}
              />
            : null}
          </>
        : null}
      </div>
    ) : tab === 'ISO' ? (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-dc-text-muted">
            Members can share a single ISO (wishlist) from their profile and optionally list it here.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/profile?tab=ISO"
              className="inline-flex rounded-full border border-dc-border bg-dc-elevated-muted px-4 py-2 text-sm font-medium text-dc-text hover:bg-dc-elevated-muted"
            >
              {isAuthenticated ? 'Add / edit your ISO' : 'Sign in to add your ISO'}
            </Link>
          </div>
        </div>

        {isoBoardLoading ?
          <p className="text-sm text-dc-muted">Loading board…</p>
        : isoBoardLoadError ?
          <div
            className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
            role="alert"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1">{isoBoardLoadError}</p>
              <button
                type="button"
                onClick={() => setIsoRefreshKey((k) => k + 1)}
                className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setIsoBoardLoadError(null)}
                className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
              >
                Dismiss
              </button>
            </div>
          </div>
        : isoBoard && !isoBoard.boardEnabled && !isoBoard.canManage ?
          <p className="text-sm text-dc-muted">The organizers have turned off the ISO board for this convention.</p>
        : organizerMode && isoBoard && !isoBoard.boardEnabled && isoBoard.canManage ?
          <p className="text-sm text-amber-200/90">Board is off for attendees. Turn it on below or leave it hidden.</p>
        : isoBoardLoadAttempted && !isoBoardLoadError && isoBoard === null && access?.canView ?
          <div className="rounded-xl border border-dc-border bg-dc-elevated/80 px-4 py-3 text-sm text-dc-muted">
            <p>ISO board unavailable.</p>
            <button
              type="button"
              onClick={() => setIsoRefreshKey((k) => k + 1)}
              className="mt-2 min-h-10 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Retry
            </button>
          </div>
        : null}

        {organizerMode && isoBoard?.canManage ?
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
            <label className="flex items-center gap-2 text-sm text-dc-text-muted">
              <input
                type="checkbox"
                checked={isoBoard.boardEnabled}
                onChange={async (e) => {
                  const on = e.target.checked
                  const r = await fetch(`/api/v1/conventions/${key}/iso-board/settings`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isoBoardEnabled: on }),
                  })
                  if (r.ok) setIsoBoard((prev) => (prev ? { ...prev, boardEnabled: on } : prev))
                }}
              />
              ISO board enabled
            </label>
          </div>
        : null}

        {access?.canView && isAuthenticated && isoBoard?.boardEnabled !== false ?
          <label className="flex items-center gap-2 text-sm text-dc-text-muted">
            <input
              type="checkbox"
              checked={Boolean(isoListed)}
              disabled={isoListed === null}
              onChange={async (e) => {
                const listed = e.target.checked
                const r = await fetch(`/api/v1/conventions/${key}/iso-board/me`, {
                  method: 'PUT',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ listed }),
                })
                if (r.ok) setIsoListed(listed)
              }}
            />
            List my ISO on this convention&apos;s board
          </label>
        : null}

        {isoBoard?.items && isoBoard.items.length === 0 ?
          <p className="text-dc-muted text-sm">No one has listed their ISO here yet.</p>
        : null}
        {isoBoard?.items.map((entry) => (
          <div
            key={entry.userId}
            className={`rounded-xl border border-dc-border bg-dc-elevated/95 p-4 ${entry.staffRemoved ? 'opacity-60' : ''}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {entry.avatarUrl ?
                  <img src={entry.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" width={40} height={40} />
                : <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-700" />}
                <div className="min-w-0">
                  <Link to={`/profile/${encodeURIComponent(entry.username)}`} className="font-medium text-dc-text hover:text-dc-accent">
                    {entry.displayName || entry.username}
                  </Link>
                  {entry.staffRemoved ?
                    <p className="text-xs text-amber-200">Removed from board by staff</p>
                  : null}
                </div>
              </div>
              {organizerMode && isoBoard.canManage ?
                <div className="flex gap-2">
                  {entry.staffRemoved ?
                    <button
                      type="button"
                      className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-text hover:bg-dc-elevated-muted"
                      onClick={async () => {
                        const r = await fetch(`/api/v1/conventions/${key}/iso-board/moderate`, {
                          method: 'POST',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: entry.userId, action: 'restore' }),
                        })
                        if (r.ok) setIsoRefreshKey((k) => k + 1)
                      }}
                    >
                      Restore
                    </button>
                  : <button
                      type="button"
                      className="rounded-full border border-rose-500/40 px-3 py-1 text-xs text-rose-200 hover:bg-rose-950/40"
                      onClick={async () => {
                        const r = await fetch(`/api/v1/conventions/${key}/iso-board/moderate`, {
                          method: 'POST',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: entry.userId, action: 'remove' }),
                        })
                        if (r.ok) setIsoRefreshKey((k) => k + 1)
                      }}
                    >
                      Remove from board
                    </button>
                  }
                </div>
              : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-dc-text-muted">{entry.body}</p>
            {entry.images.length > 0 ?
              <div className="mt-2 flex gap-0.5">
                {entry.images.map((im) => (
                  <a
                    key={im.sortOrder}
                    href={im.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block min-h-20 flex-1 overflow-hidden rounded-md border border-dc-border"
                  >
                    <img src={im.url} alt="" className="h-20 w-full object-cover" />
                  </a>
                ))}
              </div>
            : null}
          </div>
        ))}
      </div>
    ) : tab === 'Dancecard' ? (
      slug && conv ?
        <ConventionAttendeeHubShell
          slug={slug}
          timezone={conv.timezone ?? 'UTC'}
          reloadKey={dancecardReloadKey}
          slotsByDay={slotsByDay}
          programLayout={programLayout}
          onProgramLayoutChange={onProgramLayoutChange}
          onAddToDancecard={addSlotToDancecard}
          showGroups
          actionNotice={hubActionNotice}
          onDismissActionNotice={() => setHubActionNotice(null)}
          onOpenIsoTab={() => selectTab('ISO')}
          onOpenScheduleTab={() => selectTab('Schedule')}
        />
      : null
    ) : tab === 'More' ? (
      <div className="space-y-10">
        {tabLabels.filter((t) => isOverflowTab(t, tabLabels)).length > 0 ?
          <nav className="rounded-xl border border-dc-border bg-dc-elevated-solid p-4" aria-label="More convention sections">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dc-muted">More sections</p>
            <div className="flex flex-wrap gap-2">
              {tabLabels
                .filter((t) => isOverflowTab(t, tabLabels))
                .map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => selectTab(label)}
                    className={`min-h-10 rounded-lg px-3 text-sm font-medium ${
                      tab === label ?
                        'bg-dc-accent text-dc-accent-foreground'
                      : 'border border-dc-border text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
                    }`}
                  >
                    {tabDisplayLabel(label)}
                  </button>
                ))}
            </div>
          </nav>
        : null}
        {slug ?
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-dc-text">Venue maps</h2>
              <VenueMapsList conventionKey={slug} />
            </section>
            <section className="space-y-3 border-t border-dc-border pt-8">
              <h2 className="text-lg font-semibold text-dc-text">Photo gallery</h2>
              <ConventionGalleryGrid
                conventionKey={slug}
                canSubmit={Boolean(access?.hasPaidAccess)}
                canModerate={Boolean(access?.canManage || access?.isStaff)}
              />
            </section>
          </>
        : null}
        {pages.length > 0 ?
          <details className="rounded-xl border border-dc-border bg-dc-elevated/95 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-dc-text">More info</summary>
            <div className="mt-4 space-y-3">
              {pages.map((page) => (
                <div key={page.id} className="rounded-lg border border-dc-border p-3">
                  <p className="font-medium text-dc-text">{page.title}</p>
                  <p className="mt-1 text-sm text-dc-text-muted">
                    {typeof page.content === 'object' && page.content !== null && 'html' in page.content ?
                      String((page.content as { html?: string }).html ?? '')
                    : typeof page.content === 'object' && page.content !== null && 'text' in page.content ?
                      String((page.content as { text?: string }).text ?? '')
                    : null}
                  </p>
                </div>
              ))}
            </div>
          </details>
        : null}
      </div>
    ) : manageTabRequested && organizerMode && (access?.canManage || access?.isStaff) ? (
      <div className="space-y-10 text-sm">
        {manageOrgSlug ?
          <ConventionManageNav
            variant="back"
            orgSlug={manageOrgSlug}
            orgLabel={manageOrgLabel}
            conventionSlug={slug ?? undefined}
          />
        : null}
        {manageMsg && access?.canManage ?
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              isManageSuccessMessage(manageMsg) ?
                'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
              : 'border-red-500/30 bg-red-950/25 text-red-200'
            }`}
            role={isManageSuccessMessage(manageMsg) ? 'status' : 'alert'}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1">{manageMsg}</p>
              {!isManageSuccessMessage(manageMsg) ?
                <button
                  type="button"
                  onClick={() => setManageMsg(null)}
                  className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
                >
                  Dismiss
                </button>
              : null}
            </div>
          </div>
        : null}
        {!access?.canManage && access?.isStaff && (
          <p className="text-xs text-dc-muted border border-dc-border rounded-lg p-3">
            You have staff access. Organizer-only controls are hidden; roster and crew grid are below.
          </p>
        )}
        {access?.canManage && (
          <>
        {!organizerMode && dancecardLinked && slug ? (
          <DancecardOpsCard
            c2kConventionSlug={slug}
            settings={dancecardSettings ?? {}}
            embedToken={dancecardSettings?.dancecardEmbedTokenHint?.trim() || null}
            orgSlug={organizationSummary?.slug ?? null}
          />
        ) : null}
        {!organizerMode ?
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-dc-text">Logistics &amp; attendee info</h3>
          <p className="text-xs text-dc-muted">
            Shown on the public page as “At a glance” cards. Hotel blocks: JSON array of{' '}
            <code className="text-dc-text-muted">{`{"label","code?","url?"}`}</code>.
          </p>
          <div>
            <label className="block text-xs text-dc-muted mb-1">Venue profile</label>
            <select
              value={logisticsDraft.venueProfile}
              onChange={(e) => setLogisticsDraft((p) => ({ ...p, venueProfile: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            >
              <option value="">, Not set -</option>
              <option value="single_venue">Single venue</option>
              <option value="hotel_takeover">Hotel takeover</option>
              <option value="camping">Camping / outdoor</option>
              <option value="urban_multi_venue">Multi-venue (urban)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-dc-muted mb-1">Code of conduct URL</label>
            <input
              type="url"
              value={logisticsDraft.cocUrl}
              onChange={(e) => setLogisticsDraft((p) => ({ ...p, cocUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="block text-xs text-dc-muted mb-1">Safety / incident reporting note</label>
            <textarea
              value={logisticsDraft.safetyReportingNote}
              onChange={(e) => setLogisticsDraft((p) => ({ ...p, safetyReportingNote: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            />
          </div>
          <div>
            <label className="block text-xs text-dc-muted mb-1">Venue accessibility notes</label>
            <textarea
              value={logisticsDraft.accessibilityVenueNotes}
              onChange={(e) => setLogisticsDraft((p) => ({ ...p, accessibilityVenueNotes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            />
          </div>
          <div>
            <label className="block text-xs text-dc-muted mb-1">Hotel blocks (JSON)</label>
            <textarea
              value={logisticsDraft.hotelBlocksText}
              onChange={(e) => setLogisticsDraft((p) => ({ ...p, hotelBlocksText: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text font-mono text-xs"
              placeholder='[{"label":"Host hotel","code":"KINK2026"}]'
            />
          </div>
          <label className="flex items-start gap-2 text-dc-text-muted cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={logisticsDraft.publicProgramListing}
              onChange={(e) =>
                setLogisticsDraft((p) => ({ ...p, publicProgramListing: e.target.checked }))
              }
            />
            <span>
              <span className="text-dc-text font-medium">Public program listing</span>. When checked, anyone can load the
              schedule without a ticket or staff grant (documents and chat stay attendee-gated).
            </span>
          </label>
          <div>
            <label className="block text-xs text-dc-muted mb-1">
              Public staff on schedule (optional comma-separated substrings)
            </label>
            <input
              type="text"
              value={logisticsDraft.programStaffAttendeeRolesText}
              onChange={(e) => setLogisticsDraft((p) => ({ ...p, programStaffAttendeeRolesText: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
              placeholder="e.g. photo, door, medic"
            />
            <p className="text-[11px] text-dc-muted mt-1">
              Matched case-insensitively against each slot staff <code className="text-dc-text-muted">roleLabel</code>.
              Leave empty so attendees only see presenters unless they have staff access. Org moderators always see the full
              crew in Manage.
            </p>
          </div>
          <div className="border-t border-dc-border pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-dc-text">Dancecard (East Coast) link</h4>
            <p className="text-xs text-dc-muted">
              When enabled, program is edited on Kink Social and published outward to the public Dancecard directory (Event settings tab).
            </p>
            <label className="flex items-center gap-2 cursor-pointer text-dc-text-muted">
              <input
                type="checkbox"
                checked={logisticsDraft.dancecardEnabled}
                onChange={(e) => setLogisticsDraft((p) => ({ ...p, dancecardEnabled: e.target.checked }))}
              />
              <span>Enable Dancecard for this convention</span>
            </label>
            <input
              type="text"
              placeholder="Dancecard event slug (e.g. paf26)"
              value={logisticsDraft.dancecardSlug}
              onChange={(e) => setLogisticsDraft((p) => ({ ...p, dancecardSlug: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text font-mono text-sm"
            />
            <input
              type="url"
              placeholder="Public site host (optional, default production)"
              value={logisticsDraft.dancecardHost}
              onChange={(e) => setLogisticsDraft((p) => ({ ...p, dancecardHost: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
            />
            <input
              type="text"
              placeholder="Embed token (emb_…) for schedule iframe preview"
              value={logisticsDraft.dancecardEmbedTokenHint}
              onChange={(e) => setLogisticsDraft((p) => ({ ...p, dancecardEmbedTokenHint: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text font-mono text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => void saveLogistics()}
            className="min-h-11 px-4 py-2 rounded-xl bg-dc-accent text-dc-text font-medium"
          >
            Save logistics
          </button>
        </section>
        : null}

        {slug && access?.canManage ?
          <ConventionHubChannelsAdmin
            conventionSlug={slug}
            channels={channelIds}
            onCreated={() => retryLoad()}
            readOnly={!access.canManage}
          />
        : null}

        {slug && organizerOrgSlug && access?.canManage ? (
          <section className="space-y-3 border-t border-dc-border pt-8">
            <h3 className="text-base font-semibold text-dc-text">Program &amp; venues</h3>
            <p className="text-xs text-dc-muted">
              Full Dancecard organizer (program grid, venues, people, import, messaging) lives in the organizer dashboard.
              Use the link above or edit inline below.
            </p>
            <ConventionDancecardOrganizerClient
              conventionSlug={slug}
              orgSlug={organizerOrgSlug}
              onProgramChanged={() => void reloadProgramSlices()}
            />
          </section>
        ) : slug && access?.canManage ? (
          <ConventionDancecardOrganizerClient
            conventionSlug={slug}
            onProgramChanged={() => void reloadProgramSlices()}
          />
        ) : null}

        {!organizerMode ?
        <>
        <section className="space-y-3 border-t border-dc-border pt-8">
          <h3 className="text-base font-semibold text-dc-text">Documents</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Title"
              value={newDoc.title}
              onChange={(e) => setNewDoc((p) => ({ ...p, title: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            />
            <input
              type="url"
              placeholder="URL"
              value={newDoc.url}
              onChange={(e) => setNewDoc((p) => ({ ...p, url: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            />
            <select
              value={newDoc.visibility}
              onChange={(e) =>
                setNewDoc((p) => ({ ...p, visibility: e.target.value as 'ATTENDEE' | 'STAFF' | 'PUBLIC' }))
              }
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            >
              <option value="PUBLIC">Public</option>
              <option value="ATTENDEE">Attendee</option>
              <option value="STAFF">Staff</option>
            </select>
            <button
              type="button"
              onClick={() => void submitNewDoc()}
              className="min-h-11 px-4 py-2 rounded-xl bg-dc-elevated-muted text-dc-text"
            >
              Add
            </button>
          </div>
          <ul className="space-y-1">
            {docs.map((d) => (
              <li key={d.id} className="flex justify-between items-center gap-2 text-dc-text-muted">
                <a href={d.url} className="text-dc-accent hover:underline truncate">
                  {d.title}
                </a>
                <button type="button" className="text-xs text-red-300 shrink-0" onClick={() => void deleteDoc(d.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 border-t border-dc-border pt-8">
          <h3 className="text-base font-semibold text-dc-text">Custom pages (More tab)</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="slug"
              value={newPage.slug}
              onChange={(e) => setNewPage((p) => ({ ...p, slug: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            />
            <input
              type="text"
              placeholder="Title"
              value={newPage.title}
              onChange={(e) => setNewPage((p) => ({ ...p, title: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            />
            <select
              value={newPage.visibility}
              onChange={(e) =>
                setNewPage((p) => ({ ...p, visibility: e.target.value as 'ATTENDEE' | 'STAFF' | 'PUBLIC' }))
              }
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            >
              <option value="PUBLIC">Public</option>
              <option value="ATTENDEE">Attendee</option>
              <option value="STAFF">Staff</option>
            </select>
            <button
              type="button"
              onClick={() => void submitNewPage()}
              className="min-h-11 px-4 py-2 rounded-xl bg-dc-elevated-muted text-dc-text"
            >
              Add
            </button>
          </div>
          <ul className="space-y-1">
            {pages.map((p) => (
              <li key={p.id} className="flex justify-between items-center gap-2 text-dc-text-muted">
                <span>
                  {p.title} <span className="text-dc-muted">({p.slug})</span>
                </span>
                <button type="button" className="text-xs text-red-300 shrink-0" onClick={() => void deletePage(p.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 border-t border-dc-border pt-8">
          <h3 className="text-base font-semibold text-dc-text">Volunteer shifts</h3>
          <p className="text-xs text-dc-muted">
            Separate from program slots. For ops / door / setup. Attendees with access can self-sign up (capacity
            optional).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Shift title"
              value={newVolunteerShift.title}
              onChange={(e) => setNewVolunteerShift((p) => ({ ...p, title: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text sm:col-span-2"
            />
            <input
              type="datetime-local"
              value={newVolunteerShift.startsAt}
              onChange={(e) => setNewVolunteerShift((p) => ({ ...p, startsAt: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
            />
            <input
              type="datetime-local"
              value={newVolunteerShift.endsAt}
              onChange={(e) => setNewVolunteerShift((p) => ({ ...p, endsAt: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
            />
            <input
              type="text"
              placeholder="Location (optional)"
              value={newVolunteerShift.location}
              onChange={(e) => setNewVolunteerShift((p) => ({ ...p, location: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text sm:col-span-2"
            />
          </div>
          <button
            type="button"
            onClick={() => void submitVolunteerShift()}
            className="min-h-11 px-4 py-2 rounded-xl border border-dc-border bg-dc-elevated-muted text-dc-text-muted hover:text-dc-text"
          >
            Add volunteer shift
          </button>
          {volunteerShifts.length > 0 && (
            <ul className="space-y-2 mt-2">
              {volunteerShifts.map((v) => (
                <li key={v.id} className="text-xs text-dc-text-muted border border-dc-border rounded-lg p-2">
                  <span className="text-dc-text font-medium">{v.title}</span>{' '}
                  {new Date(v.startsAt).toLocaleString()} – {new Date(v.endsAt).toLocaleString()}
                  {typeof v.signupCount === 'number' ? ` · ${v.signupCount} signed up` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 border-t border-dc-border pt-8">
          <h3 className="text-base font-semibold text-dc-text">Clone (year-over-year)</h3>
          <p className="text-xs text-dc-muted">
            Copies schedule slots, presenters, staff assignments, standalone staff duties, materials, documents, and
            custom pages into a new convention slug.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="new-con-slug"
              value={cloneSlug}
              onChange={(e) => setCloneSlug(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            />
            <button
              type="button"
              onClick={() => void cloneConvention()}
              className="min-h-11 px-4 py-2 rounded-xl bg-dc-elevated-muted text-dc-text"
            >
              Clone
            </button>
          </div>
        </section>

        <section className="space-y-3 border-t border-dc-border pt-8">
          <h3 className="text-base font-semibold text-dc-text">Runner staff (standalone duties)</h3>
          <p className="text-xs text-dc-muted">
            Floaters and build blocks not tied to one program row. Paste user UUID, or pick from directory search in
            slot editor.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              placeholder="User UUID"
              value={newStaffDuty.userId}
              onChange={(e) => setNewStaffDuty((p) => ({ ...p, userId: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text font-mono text-xs sm:col-span-2"
            />
            <input
              type="text"
              placeholder="Role label"
              value={newStaffDuty.roleLabel}
              onChange={(e) => setNewStaffDuty((p) => ({ ...p, roleLabel: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            />
            <input
              type="text"
              placeholder="Station"
              value={newStaffDuty.station}
              onChange={(e) => setNewStaffDuty((p) => ({ ...p, station: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text"
            />
            <input
              type="text"
              placeholder="Location"
              value={newStaffDuty.location}
              onChange={(e) => setNewStaffDuty((p) => ({ ...p, location: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text sm:col-span-2"
            />
            <input
              type="datetime-local"
              value={newStaffDuty.startsAt}
              onChange={(e) => setNewStaffDuty((p) => ({ ...p, startsAt: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
            />
            <input
              type="datetime-local"
              value={newStaffDuty.endsAt}
              onChange={(e) => setNewStaffDuty((p) => ({ ...p, endsAt: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-xs"
            />
            <textarea
              placeholder="Notes"
              value={newStaffDuty.notes}
              onChange={(e) => setNewStaffDuty((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text sm:col-span-2"
            />
          </div>
          <button
            type="button"
            onClick={() => void submitNewStaffDuty()}
            className="min-h-11 px-4 py-2 rounded-xl border border-dc-border bg-dc-elevated-muted text-dc-text-muted hover:text-dc-text"
          >
            Add staff duty
          </button>
          {standaloneStaffDuties.length > 0 && (
            <ul className="space-y-2 mt-2">
              {standaloneStaffDuties.map((d) => (
                <li
                  key={d.id}
                  className="text-xs text-dc-text-muted border border-dc-border rounded-lg p-2 flex flex-wrap justify-between gap-2"
                >
                  <span>
                    <span className="text-dc-text font-medium">{d.roleLabel}</span> · user {d.userId.slice(0, 8)}… ·{' '}
                    {new Date(d.startsAt).toLocaleString()} – {new Date(d.endsAt).toLocaleString()}
                    {d.location ? ` · ${d.location}` : ''}
                  </span>
                  <button type="button" className="text-red-300" onClick={() => void deleteStaffDuty(d.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        </>
        : null}
        </>
        )}

        <section className="space-y-3 border-t border-dc-border pt-8">
          <h3 className="text-base font-semibold text-dc-text">Staff roster</h3>
          <p className="text-xs text-dc-muted">Presenters, runner staff, volunteers, and staff grants.</p>
          {staffRoster.length === 0 ? (
            <p className="text-xs text-dc-muted">No roster entries.</p>
          ) : (
            <ul className="space-y-2">
              {staffRoster.map((p) => (
                <li key={p.userId} className="flex flex-wrap justify-between gap-2 border border-dc-border rounded-lg p-2 text-xs">
                  <Link
                    to={`/profile/${encodeURIComponent(p.username)}`}
                    className="text-dc-accent hover:underline font-medium"
                  >
                    {p.displayName || p.username}
                  </Link>
                  <span className="text-dc-muted">{p.roles.join(', ')}</span>
                  {p.nextStartsAt && (
                    <span className="w-full text-dc-text-muted">
                      Next: {new Date(p.nextStartsAt).toLocaleString()} · {p.nextLabel}
                    </span>
                  )}
                  {access?.canManage && p.canAssignStaffSchedules !== undefined ?
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-dc-text-muted">
                      <input
                        type="checkbox"
                        checked={Boolean(p.canAssignStaffSchedules)}
                        onChange={(e) => void updateStaffAssignPermission(p.userId, e.target.checked)}
                      />
                      <span>May assign standalone staff duties for this convention</span>
                    </label>
                  : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 border-t border-dc-border pt-8">
          <h3 className="text-base font-semibold text-dc-text">Crew grid (read-only)</h3>
          <p className="text-xs text-dc-muted">Half-hour buckets from runner-assigned staff duties.</p>
          {crewGridDays.length === 0 ? (
            <p className="text-xs text-dc-muted">No staff assignments to plot.</p>
          ) : (
            <div className="space-y-6 overflow-x-auto">
              {crewGridDays.map((day) => (
                <div key={day.dayKey}>
                  <p className="text-sm font-medium text-dc-text mb-2">{day.dayLabel}</p>
                  <table className="min-w-full text-xs border border-dc-border border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-dc-border p-1 text-left text-dc-muted">Person</th>
                        {day.buckets.map((b, i) => (
                          <th key={i} className="border border-dc-border p-1 text-dc-muted whitespace-nowrap">
                            {new Date(b.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {day.rows.map((r) => (
                        <tr key={r.userId}>
                          <td className="border border-dc-border p-1 text-dc-text whitespace-nowrap">
                            <Link
                              to={`/profile/${encodeURIComponent(r.username)}`}
                              className="text-dc-accent hover:underline"
                            >
                              {r.displayName || r.username}
                            </Link>
                          </td>
                          {r.cells.map((c, i) => (
                            <td
                              key={i}
                              className="border border-dc-border p-1 text-dc-text-muted max-w-[120px] truncate"
                              title={c ?? ''}
                            >
                              {c ?? '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    ) : tab === 'Schedule' ?
      <div className="space-y-6">
        <ConventionProgramSchedulePanel
          encodedSlug={key}
          loading={slots === null}
          scheduleLocked={false}
          isAuthenticated={isAuthenticated}
          anchorEventId={conv?.anchorEventId ?? null}
          organization={organizationSummary}
          embedScheduleUrl={embedScheduleUrl}
          dancecardLinked={dancecardLinked}
          contributorsPreview={contributorsPreview}
          slots={slots}
          slotsByDay={slotsByDay}
          timezone={conv?.timezone ?? 'UTC'}
          attendeeOk={attendeeOk}
          myScheduleItems={myScheduleItems}
          programLayout={programLayout}
          onProgramLayoutChange={onProgramLayoutChange}
          onAddToDancecard={addSlotToDancecard}
          onOpenDancecardTab={() => selectTab('Dancecard')}
          canFollow={isAuthenticated}
          isFollowing={isPinned}
          onFollowEvent={togglePin}
        />
      </div>
    : slots && slots.length === 0 ? (
      <p className="text-dc-muted text-sm">No schedule slots yet.</p>
    ) : (
      <p className="text-sm text-dc-muted">Open the Schedule tab to view the program.</p>
    )

  const convShareImage = dancecardSettings?.shareImageUrl ?? null

  return (
    <>
    <div
      className="convention-public-shell"
      style={themeVars as CSSProperties}
    >
    {conv && slug ?
      <ScopePageMeta
        title={heroTitle}
        description={heroSummary ?? undefined}
        path={`/conventions/${encodeURIComponent(slug)}`}
        shareImageUrl={convShareImage}
        heroImageUrl={anchorEventSummary?.imageUrl}
        logoUrl={heroLogo}
      />
    : null}
    {!organizerMode ? (
      <ConventionHero
        banner={anchorEventSummary?.imageUrl ?? null}
        logo={heroLogo}
        eyebrow={heroEyebrow}
        title={heroTitle}
        summary={heroSummary}
        locationLabel={locationLabel}
        startsAt={conv?.startsAt ?? null}
        endsAt={conv?.endsAt ?? null}
        timezone={conv?.timezone ?? null}
        themeAccent={themeAccent}
        organization={
          organizationSummary
            ? {
                href: `/orgs/${encodeURIComponent(organizationSummary.slug)}`,
                label: organizationSummary.displayName,
              }
            : null
        }
        anchorEvent={
          anchorEventSummary
            ? { href: `/events/${anchorEventSummary.id}`, label: anchorEventSummary.title }
            : null
        }
        registrationCta={
          slug
            ? {
                href: `/conventions/${encodeURIComponent(slug)}/register`,
                label: access?.hasPaidAccess ? 'Manage registration' : 'Register',
                registered: !!access?.hasPaidAccess,
              }
            : null
        }
        organizerConsoleHref={organizerMode ? organizerConventionHref : null}
        isPinned={isPinned}
        showPin={isAuthenticated}
        onTogglePin={togglePin}
        hasFullDescription={hasFullDescription}
        onReadFullDescription={() => selectTab('Welcome')}
        previewRole={previewRole}
        onExitPreview={previewRole ? exitPreview : undefined}
        conventionId={conv?.id ?? null}
        conventionPath={
          slug ? `/conventions/${encodeURIComponent(slug)}` : null
        }
        showReport={Boolean(isAuthenticated && conv?.id)}
      />
    ) : null}
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 sm:py-8 c2k-mobile-scroll-pad">
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
      {organizerMode && manageOrgSlug ?
        <ConventionManageNav
          orgSlug={manageOrgSlug}
          orgLabel={manageOrgLabel}
          conventionName={conv?.name ?? 'Program'}
        />
      : null}
      {organizerMode ? (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-dc-text">{conv?.name ?? '…'}</h1>
            {conv && (
              <p className="text-xs text-dc-muted mt-1">
                {conv.timezone} · {new Date(conv.startsAt).toLocaleString()} – {new Date(conv.endsAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Mobile key facts before tabs */}
      {!organizerMode && (dateLabel || locationLabel || conv?.settings?.venueProfile) ?
        <ul className="mb-4 space-y-2 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 text-sm text-dc-text lg:hidden">
          {dateLabel ? <li>{dateLabel}</li> : null}
          {locationLabel ? <li>{locationLabel}</li> : null}
          {conv?.settings?.venueProfile ?
            <li>{VENUE_LABELS[conv.settings.venueProfile] ?? conv.settings.venueProfile}</li>
          : null}
        </ul>
      : null}

      <div className="sticky top-[var(--c2k-sticky-below-header)] z-20 -mx-4 mb-4 border-b border-dc-border bg-dc-elevated-solid/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:border-dc-border sm:px-3">
        <div
          className="flex gap-1 overflow-x-auto pb-0.5 c2k-no-scrollbar snap-x snap-mandatory sm:flex-wrap sm:overflow-visible"
          role="tablist"
          aria-label="Convention tabs"
        >
          {CONVENTION_PRIMARY_TABS.map((label) => (
            <TabButton
              key={label}
              label={tabDisplayLabel(label)}
              isActive={
                label === 'More' ?
                  isOverflowTab(tab, tabLabels) || tab === 'More'
                : tab === label
              }
              onClick={() => selectTab(label)}
              className="snap-start shrink-0 whitespace-nowrap"
            />
          ))}
          {organizerMode ?
            <Link
              to={`/conventions/${encodeURIComponent(slug ?? '')}?tab=Schedule`}
              className="hidden flex-shrink-0 snap-start min-h-10 md:inline-flex items-center rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
            >
              Public schedule
            </Link>
          : null}
        </div>
      </div>
      {conv && scheduleOpen && slots && slots.length > 0 && tab === 'Schedule' ? (
        <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dc-text-muted">
          <a href={`/api/v1/conventions/${key}/program.ics`} className="text-dc-accent hover:underline">
            Download full program calendar (.ics)
          </a>
          {attendeeOk ?
            <a href={`/api/v1/conventions/${key}/my-staff-duties.ics`} className="text-dc-accent hover:underline">
              My staff &amp; volunteer duties (.ics)
            </a>
          : null}
        </p>
      ) : null}
      {scheduleBlock}
        </div>
        {!organizerMode && slug ?
          <div className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-24">
              <ConventionEventSidebar
                conventionSlug={slug}
                isAuthenticated={isAuthenticated}
                dateLabel={dateLabel || null}
                locationLabel={locationLabel}
                eventTypeLabel={heroEyebrow}
                settings={conv?.settings}
                organization={organizationSummary}
                registrationCta={{
                  href: `/conventions/${encodeURIComponent(slug)}/register`,
                  label: access?.hasPaidAccess ? 'Manage registration' : 'Register',
                  registered: !!access?.hasPaidAccess,
                }}
                calendar={
                  conv ?
                    {
                      title: heroTitle,
                      startsAt: conv.startsAt,
                      endsAt: conv.endsAt,
                      location: locationLabel,
                      description: heroSummary,
                      pagePath: `/conventions/${encodeURIComponent(slug)}`,
                      programIcsPath: `/api/v1/conventions/${key}/program.ics`,
                      showProgramIcs: Boolean(slots && slots.length > 0),
                    }
                  : null
                }
              />
            </div>
          </div>
        : null}
      </div>

      {/* Mobile: organizer + links after main content */}
      {!organizerMode && slug ?
        <div className="mt-8 space-y-4 lg:hidden">
          <ConventionEventSidebar
            conventionSlug={slug}
            isAuthenticated={isAuthenticated}
            dateLabel={dateLabel || null}
            locationLabel={locationLabel}
            eventTypeLabel={heroEyebrow}
            settings={conv?.settings}
            organization={organizationSummary}
            registrationCta={null}
            variant="mobile"
            showKeyDetails
            calendar={
              conv ?
                {
                  title: heroTitle,
                  startsAt: conv.startsAt,
                  endsAt: conv.endsAt,
                  location: locationLabel,
                  description: heroSummary,
                  pagePath: `/conventions/${encodeURIComponent(slug)}`,
                  programIcsPath: `/api/v1/conventions/${key}/program.ics`,
                  showProgramIcs: Boolean(slots && slots.length > 0),
                }
              : null
            }
          />
        </div>
      : null}
    </div>
    </div>
    {!organizerMode && slug && !access?.hasPaidAccess ?
      <div className="lg:hidden">
        <MobileActionBar
          status="Registration open"
          primary={{
            label: 'Register',
            href: `/conventions/${encodeURIComponent(slug)}/register`,
          }}
        />
      </div>
    : null}
    {confirmDialog}
    </>
  )
}
