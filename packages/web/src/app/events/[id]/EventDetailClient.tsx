import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { startEventCheckout } from '@/hooks/useApiOrgStripe'
import PaymentsBuyerDisclaimer from '@/components/payments/PaymentsBuyerDisclaimer'
import EventMatchmakerPanel from '@/components/EventMatchmakerPanel'
import EventDiscussionPanel from '@/components/events/EventDiscussionPanel'
import EventRsvpPrivacyNote from '@/components/events/EventRsvpPrivacyNote'
import EventDetailMobileFacts from '@/components/events/EventDetailMobileFacts'
import EventSocialOrientation, { type EventTimingStatus } from '@/components/events/EventSocialOrientation'
import EventSaveButton from '@/components/events/EventSaveButton'
import AlphaTestBadge from '@/components/alpha/AlphaTestBadge'
import ConventionProgramSchedulePanel from '@/components/conventions/ConventionProgramSchedulePanel'
import ScopePageMeta from '@/components/seo/ScopePageMeta'
import { Link } from 'react-router-dom'
import { buildLoginHref } from '@/lib/auth-links'
import MobileActionBar from '@/components/shell/MobileActionBar'
import TabButton from '@/components/ui/TabButton'
import CopyLinkOverflowMenu from '@/components/ui/CopyLinkOverflowMenu'
import ContentSection from '@/components/ui/ContentSection'
import ReportAction from '@/components/moderation/ReportAction'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import { getMockEventById, getMockGroupById, mockPeople, mockVendors } from '@/data/mock-data'
import type { ApiEventListItem } from '@/lib/api-event-mapper'
import { mapApiEventToMockEvent } from '@/lib/api-event-mapper'
import { buildEventIcsDownloadUrl, buildGoogleCalendarUrl, buildWebcalSubscribeUrl } from '@/lib/event-calendar-links'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import { isTicketEmbedUrlAllowed } from '@/lib/ticket-embed'
import { isSocialStyleEventCategory, RSVP_LABEL_INTERESTED } from '@c2k/shared'
import { useTabFromUrl } from '@/hooks/useTabFromUrl'
import { useAuth } from '@/contexts/AuthContext'
import { eventTarget } from '@/lib/moderation/report-targets'
import { cardSurfaceBaseClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'

type AttendeesPayload = {
  goingCount: number
  maybeCount: number
  waitlistCount: number
  attendeeListVisibility: string
  items: Array<{ userId: string; username: string; displayName: string | null; avatarUrl: string | null }>
}

type RsvpQueueRow = {
  userId: string
  username: string
  displayName: string | null
  status: string
  rsvpApprovalStatus: string
  screeningAnswer: string | null
}

type HostEditDraft = {
  title: string
  description: string
  location: string
  publicLocationSummary: string
  locationVisibility: 'public' | 'rsvp' | 'approved'
  screeningQuestion: string
  newcomerFriendly: boolean
  accessibilityNotes: string
  capacityMax: string
  attendeeListVisibility: 'public' | 'count_only'
  dressCode: string
  expectedCostText: string
  /** Dollars string for org Stripe ticket price (empty = no Checkout price). */
  priceDollars: string
}

const EVENT_TABS = ['Overview', 'Attendees', 'Vendors', 'Discussion', 'Safety Info'] as const
const EVENT_TABS_WITH_MM = [...EVENT_TABS, 'Matchmaker'] as const
const MUNCH_TABS = ['Overview', 'Attendees', 'Safety Info'] as const

const UUID_PARAM_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formatEventWhen(startsAt: string, endsAt?: string | null): string {
  const s = new Date(startsAt)
  if (Number.isNaN(s.getTime())) return startsAt
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  if (!endsAt) {
    return `${s.toLocaleDateString(undefined, dateOpts)} · ${s.toLocaleTimeString(undefined, timeOpts)}`
  }
  const e = new Date(endsAt)
  if (Number.isNaN(e.getTime())) {
    return `${s.toLocaleDateString(undefined, dateOpts)} · ${s.toLocaleTimeString(undefined, timeOpts)}`
  }
  const sameDay = s.toDateString() === e.toDateString()
  if (sameDay) {
    return `${s.toLocaleDateString(undefined, dateOpts)} · ${s.toLocaleTimeString(undefined, timeOpts)} – ${e.toLocaleTimeString(undefined, timeOpts)}`
  }
  return `${s.toLocaleString(undefined, { ...dateOpts, ...timeOpts })} → ${e.toLocaleString(undefined, { ...dateOpts, ...timeOpts })}`
}

function formatInTimezone(iso: string, ianaTz: string | null | undefined): string | null {
  if (!ianaTz?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  try {
    return d.toLocaleString(undefined, {
      timeZone: ianaTz.trim(),
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return null
  }
}

function virtualStyleLabel(style: string | null | undefined): string {
  if (style === 'education') return 'Class'
  if (style === 'mixed') return 'Mixed'
  return 'Social'
}

function recordingPolicyLabel(p: string | null | undefined): string | null {
  if (!p) return null
  const map: Record<string, string> = {
    not_recorded: 'Not recorded',
    live_only: 'Live only (no recording)',
    shared_with_registrants: 'Recorded. Shared with attendees',
    tbd: 'Recording TBD',
  }
  return map[p] ?? p
}

type ProgramSummary = { slug: string; name: string; slotCount: number }

function looksLikeHttpUrl(s: string | null | undefined): boolean {
  if (!s?.trim()) return false
  return /^https?:\/\//i.test(s.trim())
}

const DEFAULT_EVENT = {
  id: 1,
  title: 'Event Not Found',
  date: '',
  location: '',
  rsvpCount: 0,
  hostVerified: false,
  hostName: '',
  description: 'This event could not be found.',
  rules: '',
  dressCode: '',
  expectedCostText: null as string | null,
  consentPolicy: '',
}

type ApiEventDetail = ApiEventListItem & { groupId?: string | null }

export default function EventDetailClient() {
  const params = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, viewerUsername } = useAuth()
  const id = params.id as string
  const [rsvpKind, setRsvpKind] = useState<'going' | 'maybe' | 'waitlist' | null>(null)
  const [rsvpBusy, setRsvpBusy] = useState(false)
  const [rsvpMsg, setRsvpMsg] = useState<string | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [payMsg, setPayMsg] = useState<string | null>(null)
  const screeningAnswerRef = useRef<HTMLInputElement>(null)
  const [attendeesPayload, setAttendeesPayload] = useState<AttendeesPayload | null>(null)
  const [rsvpQueue, setRsvpQueue] = useState<RsvpQueueRow[]>([])
  const [rsvpQueueBusy, setRsvpQueueBusy] = useState(false)
  const [hostEditDraft, setHostEditDraft] = useState<HostEditDraft | null>(null)
  const [hostEditMsg, setHostEditMsg] = useState<string | null>(null)
  const [hostEditBusy, setHostEditBusy] = useState(false)
  const [apiEvent, setApiEvent] = useState<ApiEventDetail | null>(null)
  const [apiMode, setApiMode] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [eventReviewRating, setEventReviewRating] = useState(5)
  const [eventReviewBody, setEventReviewBody] = useState('')
  const [eventReviewMsg, setEventReviewMsg] = useState<string | null>(null)
  const [contributors, setContributors] = useState<
    Array<{
      id: string
      kind: string
      label: string
      description: string | null
      vendorSlug: string | null
      username: string | null
    }>
  >([])
  const [programSummary, setProgramSummary] = useState<ProgramSummary | null>(null)

  const isMunchSimple =
    apiMode === 'ready' &&
    isSocialStyleEventCategory(apiEvent?.category) &&
    !apiEvent?.hasProgram

  const eventTabs = useMemo(() => {
    if (!UUID_PARAM_RE.test(id)) {
      return EVENT_TABS as unknown as readonly string[]
    }
    if (isMunchSimple) {
      return MUNCH_TABS as unknown as readonly string[]
    }
    const baseList: string[] = apiMode === 'ready' ? [...EVENT_TABS_WITH_MM] : [...EVENT_TABS]
    if (apiMode === 'ready' && apiEvent?.hasProgram && apiEvent.conventionSlug) {
      const oi = baseList.indexOf('Overview')
      if (oi >= 0) baseList.splice(oi + 1, 0, 'Schedule')
      else baseList.unshift('Schedule')
    }
    return baseList as readonly string[]
  }, [id, apiMode, apiEvent?.hasProgram, apiEvent?.conventionSlug, isMunchSimple])

  const [activeTab, setActiveTabState] = useTabFromUrl(eventTabs, EVENT_TABS[0])

  const selectTab = useCallback(
    (tab: string) => {
      setActiveTabState(tab)
      navigate(`${pathname}?tab=${encodeURIComponent(tab)}`)
    },
    [pathname, navigate, setActiveTabState]
  )

  const mockEvent = getMockEventById(id)

  useEffect(() => {
    if (!UUID_PARAM_RE.test(id)) {
      setApiEvent(null)
      setApiMode('idle')
      return
    }
    let cancelled = false
    setApiMode('loading')
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/events/${encodeURIComponent(id)}`, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setApiMode('error')
          return
        }
        const data = (await r.json()) as { event: ApiEventDetail; program?: ProgramSummary | null }
        if (cancelled) return
        setApiEvent(data.event ?? null)
        setProgramSummary(data.program ?? null)
        setApiMode(data.event ? 'ready' : 'error')
        const vs = data.event?.viewerRsvpStatus
        setRsvpKind(vs === 'going' || vs === 'maybe' || vs === 'waitlist' ? vs : null)
        setRsvpMsg(null)
      } catch {
        if (!cancelled) setApiMode('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!hostEditMsg || hostEditMsg !== 'Saved.') return
    const timer = window.setTimeout(() => setHostEditMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [hostEditMsg])

  useEffect(() => {
    if (!eventReviewMsg || !eventReviewMsg.startsWith('Thanks')) return
    const timer = window.setTimeout(() => setEventReviewMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [eventReviewMsg])

  useEffect(() => {
    if (!UUID_PARAM_RE.test(id) || apiMode !== 'ready') return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/events/${encodeURIComponent(id)}/contributors`, { credentials: 'include' })
        if (!r.ok || cancelled) return
        const d = (await r.json()) as {
          items: Array<{
            id: string
            kind: string
            label: string
            description: string | null
            vendorSlug?: string | null
            username?: string | null
          }>
        }
        if (!cancelled) {
          setContributors(
            (d.items ?? []).map((it) => ({
              ...it,
              vendorSlug: it.vendorSlug ?? null,
              username: it.username ?? null,
            }))
          )
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, apiMode])

  const isApiEventRoute = UUID_PARAM_RE.test(id)

  const putRsvp = useCallback(
    async (status: 'going' | 'maybe' | 'not_going') => {
      if (isApiEventRoute && apiMode === 'ready' && apiEvent) {
        if (!isAuthenticated) return
        if (apiEvent.rsvpOpen === false && status !== 'not_going') {
          setRsvpMsg('RSVPs are closed for this event.')
          return
        }
        setRsvpMsg(null)
        const q = apiEvent.screeningQuestion?.trim()
        if (q && (status === 'going' || status === 'maybe')) {
          const ans = screeningAnswerRef.current?.value?.trim()
          if (!ans) {
            setRsvpMsg('Please answer the host’s question to RSVP.')
            return
          }
        }
        setRsvpBusy(true)
        try {
          const body: Record<string, unknown> = { status }
          const ans = screeningAnswerRef.current?.value?.trim()
          if (ans) body.screeningAnswer = ans
          const r = await fetch(`/api/v1/events/${encodeURIComponent(id)}/rsvp`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const d = (await r.json()) as {
            ok?: boolean
            rsvpCount?: number
            status?: string | null
            rsvpApprovalStatus?: ApiEventDetail['viewerRsvpApprovalStatus']
            error?: string
          }
          if (!r.ok) {
            setRsvpMsg(d.error ?? 'Could not update RSVP')
            return
          }
          const st =
            d.status === 'going' || d.status === 'maybe' || d.status === 'waitlist' ? d.status : null
          setRsvpKind(st)
          try {
            const er = await fetch(`/api/v1/events/${encodeURIComponent(id)}`, { credentials: 'include' })
            if (er.ok) {
              const refreshed = (await er.json()) as { event: ApiEventDetail; program?: ProgramSummary | null }
              if (refreshed.event) {
                setApiEvent(refreshed.event)
                setProgramSummary(refreshed.program ?? null)
                const v2 = refreshed.event.viewerRsvpStatus
                setRsvpKind(
                  v2 === 'going' || v2 === 'maybe' || v2 === 'waitlist' ? v2 : null
                )
                return
              }
            }
          } catch {
            /* fall through */
          }
          setApiEvent((e) =>
            e
              ? {
                  ...e,
                  rsvpCount: typeof d.rsvpCount === 'number' ? d.rsvpCount : e.rsvpCount,
                  viewerRsvpStatus: (d.status as ApiEventDetail['viewerRsvpStatus']) ?? null,
                  viewerRsvpApprovalStatus: d.rsvpApprovalStatus ?? e.viewerRsvpApprovalStatus,
                }
              : null
          )
        } finally {
          setRsvpBusy(false)
        }
        return
      }
      if (status === 'going') setRsvpKind((k) => (k === 'going' ? null : 'going'))
      else if (status === 'maybe') setRsvpKind((k) => (k === 'maybe' ? null : 'maybe'))
      else setRsvpKind(null)
    },
    [isApiEventRoute, apiMode, apiEvent, id, isAuthenticated]
  )

  const attendeePreview = useMemo(() => {
    return mockPeople.filter((p) => p.username !== 'RopeDreamer').slice(0, 6)
  }, [mockEvent?.id])

  const vendorPreview = useMemo(() => mockVendors.slice(0, 3), [])

  const event = useMemo(() => {
    if (apiMode === 'ready' && apiEvent) {
      const m = mapApiEventToMockEvent(apiEvent)
      return {
        id: m.id,
        title: m.title,
        date: m.date,
        location: m.location,
        rsvpCount: m.rsvpCount,
        hostVerified: m.hostVerified,
        hostName: m.hostName ?? 'Community Host',
        description: m.description ?? 'Event details coming soon.',
        rules: 'Respect boundaries. Consent is mandatory.',
        dressCode: apiEvent.dressCode?.trim() || 'Casual, venue-appropriate.',
        expectedCostText: apiEvent.expectedCostText?.trim() || null,
        consentPolicy: 'Explicit verbal consent required.',
      }
    }
    if (mockEvent) {
      return {
        id: mockEvent.id,
        title: mockEvent.title,
        date: mockEvent.date,
        location: mockEvent.location,
        rsvpCount: mockEvent.rsvpCount,
        hostVerified: mockEvent.hostVerified,
        hostName: mockEvent.hostName ?? 'Community Host',
        description: mockEvent.description ?? 'Event details coming soon.',
        rules: mockEvent.rules ?? 'Respect boundaries. Consent is mandatory.',
        dressCode: mockEvent.dressCode ?? 'Casual, venue-appropriate.',
        expectedCostText: null as string | null,
        consentPolicy: mockEvent.consentPolicy ?? 'Explicit verbal consent required.',
      }
    }
    return DEFAULT_EVENT
  }, [apiMode, apiEvent, mockEvent])

  const groupLinkId = apiEvent?.groupId ?? mockEvent?.groupId
  const orgSlug = apiEvent?.organizationSlug
  const ticketPurchaseUrl = apiEvent?.ticketPurchaseUrl
  const ticketEmbedUrl = apiEvent?.ticketEmbedUrl
  const showTicketEmbed = Boolean(ticketEmbedUrl && isTicketEmbedUrlAllowed(ticketEmbedUrl))
  const priceCents = apiEvent?.priceCents ?? null
  const payments = apiEvent?.payments ?? null
  const hasOrgTicketPrice =
    typeof priceCents === 'number' && priceCents > 0 && Boolean(apiEvent?.organizationId)
  const showTicketsSection = Boolean(
    ticketPurchaseUrl || showTicketEmbed || hasOrgTicketPrice || payments?.externalPaymentUrl,
  )

  useEffect(() => {
    const paid = searchParams.get('paid')
    if (paid === '1') {
      setPayMsg('Payment received. Access updates when Stripe finishes processing or the organizer confirms.')
    } else if (paid === 'cancel') {
      setPayMsg('Checkout canceled.')
    }
  }, [searchParams])

  const whenLine = useMemo(() => {
    if (apiMode === 'ready' && apiEvent) return formatEventWhen(apiEvent.startsAt, apiEvent.endsAt)
    return event.date
  }, [apiMode, apiEvent, event.date])

  const hostTzLine = useMemo(() => {
    if (apiMode !== 'ready' || !apiEvent) return null
    return formatInTimezone(apiEvent.startsAt, apiEvent.eventTimezone)
  }, [apiMode, apiEvent])

  const startsInMs = useMemo(() => {
    if (apiMode !== 'ready' || !apiEvent) return null
    const t = new Date(apiEvent.startsAt).getTime()
    if (Number.isNaN(t)) return null
    return t - Date.now()
  }, [apiMode, apiEvent])

  const calendarLinks = useMemo(() => {
    if (apiMode !== 'ready' || !apiEvent || !UUID_PARAM_RE.test(id)) return null
    const location =
      apiEvent.location?.trim() ?
        apiEvent.location.trim()
      : apiEvent.publicLocationSummary?.trim() ?
        apiEvent.publicLocationSummary.trim()
      : undefined
    const eventPageUrl = `${window.location.origin}/events/${encodeURIComponent(id)}`
    const googleUrl = buildGoogleCalendarUrl({
      title: apiEvent.title,
      startsAt: apiEvent.startsAt,
      endsAt: apiEvent.endsAt,
      description: apiEvent.description?.replace(/<[^>]+>/g, '').trim() || undefined,
      location,
      eventPageUrl,
    })
    return {
      googleUrl,
      icsUrl: buildEventIcsDownloadUrl(id),
      webcalUrl: buildWebcalSubscribeUrl(id),
    }
  }, [apiMode, apiEvent, id])

  const countdownLabel = useMemo(() => {
    if (startsInMs == null || startsInMs < 0 || startsInMs > 7 * 24 * 60 * 60 * 1000) return null
    const h = Math.floor(startsInMs / (60 * 60 * 1000))
    const d = Math.floor(h / 24)
    if (d > 0) return `Starts in ${d} day${d === 1 ? '' : 's'}`
    if (h > 0) return `Starts in ${h} hour${h === 1 ? '' : 's'}`
    const m = Math.max(1, Math.floor(startsInMs / (60 * 1000)))
    return `Starts in ${m} min`
  }, [startsInMs])

  const isConventionSurface = Boolean(
    apiMode === 'ready' && apiEvent?.hasProgram && apiEvent.conventionSlug
  )
  const isVirtual = Boolean(apiMode === 'ready' && apiEvent?.eventFormat === 'virtual')
  const virtualJoinUrl =
    isVirtual && apiEvent?.location && looksLikeHttpUrl(apiEvent.location) ? apiEvent.location.trim() : null
  const virtualPlatformHint =
    isVirtual && apiEvent?.location?.trim() && !looksLikeHttpUrl(apiEvent.location) ? apiEvent.location.trim() : null
  const joinLinkGated =
    Boolean(isVirtual && apiEvent?.hasVirtualJoinLink && apiEvent?.joinLinkRedacted)
  const virtualStyle = apiEvent?.virtualSessionStyle ?? 'social'
  const showEducationBlocks =
    isVirtual && (virtualStyle === 'education' || virtualStyle === 'mixed')
  const hostUsername = apiMode === 'ready' ? apiEvent?.hostUsername ?? null : null

  const viewerIsHost = Boolean(
    isAuthenticated && hostUsername && viewerUsername && hostUsername === viewerUsername
  )

  const rsvpLocked = isApiEventRoute && !isAuthenticated
  const rsvpClosed = Boolean(isApiEventRoute && apiMode === 'ready' && apiEvent && apiEvent.rsvpOpen === false)

  const eventTimingStatus = useMemo((): EventTimingStatus | null => {
    if (apiMode !== 'ready' || !apiEvent) return null
    if (startsInMs != null && startsInMs < 0) return 'past'
    if (rsvpClosed) return 'rsvp_closed'
    if (
      typeof apiEvent.capacityMax === 'number' &&
      apiEvent.capacityMax > 0 &&
      event.rsvpCount >= apiEvent.capacityMax
    ) {
      return 'at_capacity'
    }
    return 'upcoming'
  }, [apiMode, apiEvent, startsInMs, rsvpClosed, event.rsvpCount])

  const hasDiscussionTab = eventTabs.includes('Discussion')

  const runApproval = useCallback(
    async (userId: string, decision: 'approve' | 'reject') => {
      if (!UUID_PARAM_RE.test(id)) return
      setRsvpQueueBusy(true)
      try {
        const r = await fetch(`/api/v1/events/${encodeURIComponent(id)}/rsvp-approval`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, decision }),
        })
        if (!r.ok) return
        const er = await fetch(`/api/v1/events/${encodeURIComponent(id)}`, { credentials: 'include' })
        if (er.ok) {
          const refreshed = (await er.json()) as { event: ApiEventDetail }
          if (refreshed.event) setApiEvent(refreshed.event)
        }
        const rq = await fetch(`/api/v1/events/${encodeURIComponent(id)}/rsvps`, { credentials: 'include' })
        if (rq.ok) {
          const d = (await rq.json()) as { items: RsvpQueueRow[] }
          setRsvpQueue(d.items ?? [])
        }
      } finally {
        setRsvpQueueBusy(false)
      }
    },
    [id]
  )

  useEffect(() => {
    if (!UUID_PARAM_RE.test(id) || activeTab !== 'Attendees' || apiMode !== 'ready') {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/events/${encodeURIComponent(id)}/attendees`)
        if (!r.ok || cancelled) return
        const d = (await r.json()) as AttendeesPayload
        if (!cancelled) setAttendeesPayload(d)
      } catch {
        if (!cancelled) setAttendeesPayload(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, activeTab, apiMode])

  useEffect(() => {
    if (!apiEvent || !viewerIsHost) {
      setHostEditDraft(null)
      return
    }
    const vis = apiEvent.locationVisibility
    const lv: HostEditDraft['locationVisibility'] =
      vis === 'rsvp' || vis === 'approved' ? vis : 'public'
    const alv: HostEditDraft['attendeeListVisibility'] =
      apiEvent.attendeeListVisibility === 'count_only' ? 'count_only' : 'public'
    setHostEditDraft({
      title: apiEvent.title,
      description: apiEvent.description ?? '',
      location: apiEvent.location ?? '',
      publicLocationSummary: apiEvent.publicLocationSummary ?? '',
      locationVisibility: lv,
      screeningQuestion: apiEvent.screeningQuestion ?? '',
      newcomerFriendly: !!apiEvent.newcomerFriendly,
      accessibilityNotes: apiEvent.accessibilityNotes ?? '',
      capacityMax: apiEvent.capacityMax != null ? String(apiEvent.capacityMax) : '',
      attendeeListVisibility: alv,
      dressCode: apiEvent.dressCode ?? '',
      expectedCostText: apiEvent.expectedCostText ?? '',
      priceDollars:
        typeof apiEvent.priceCents === 'number' && apiEvent.priceCents > 0
          ? (apiEvent.priceCents / 100).toFixed(2)
          : '',
    })
  }, [apiEvent, viewerIsHost])

  useEffect(() => {
    if (!UUID_PARAM_RE.test(id) || !isAuthenticated || apiMode !== 'ready' || !apiEvent) {
      setRsvpQueue([])
      return
    }
    if (!viewerIsHost || !(apiEvent.pendingRsvpApprovals && apiEvent.pendingRsvpApprovals > 0)) {
      setRsvpQueue([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/events/${encodeURIComponent(id)}/rsvps`, { credentials: 'include' })
        if (!r.ok || cancelled) return
        const d = (await r.json()) as { items: RsvpQueueRow[] }
        if (!cancelled) setRsvpQueue(d.items ?? [])
      } catch {
        if (!cancelled) setRsvpQueue([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isAuthenticated, apiMode, apiEvent, viewerIsHost])

  async function submitHostEdit(ev: FormEvent) {
    ev.preventDefault()
    if (!UUID_PARAM_RE.test(id) || !hostEditDraft) return
    setHostEditBusy(true)
    setHostEditMsg(null)
    try {
      const capRaw = hostEditDraft.capacityMax.trim()
      let capacityMax: number | null = null
      if (capRaw) {
        const n = parseInt(capRaw, 10)
        if (!Number.isNaN(n) && n > 0) capacityMax = n
      }
      const priceRaw = hostEditDraft.priceDollars.trim()
      let priceCentsPatch: number | null = null
      if (priceRaw) {
        const dollars = Number.parseFloat(priceRaw)
        if (Number.isNaN(dollars) || dollars < 0) {
          setHostEditMsg('Ticket price must be a valid dollar amount')
          setHostEditBusy(false)
          return
        }
        priceCentsPatch = Math.round(dollars * 100)
      }
      const body: Record<string, unknown> = {
        title: hostEditDraft.title.trim(),
        description: hostEditDraft.description.trim() || null,
        dressCode: hostEditDraft.dressCode.trim() || null,
        expectedCostText: hostEditDraft.expectedCostText.trim() || null,
        priceCents: priceCentsPatch,
      }
      if (!isVirtual) {
        body.location = hostEditDraft.location.trim() || null
        body.publicLocationSummary = hostEditDraft.publicLocationSummary.trim() || null
        body.locationVisibility = hostEditDraft.locationVisibility
        body.screeningQuestion = hostEditDraft.screeningQuestion.trim() || null
        body.newcomerFriendly = hostEditDraft.newcomerFriendly
        body.accessibilityNotes = hostEditDraft.accessibilityNotes.trim() || null
        body.capacityMax = capacityMax
        body.attendeeListVisibility = hostEditDraft.attendeeListVisibility
      } else {
        body.location = hostEditDraft.location.trim() || null
      }
      const r = await fetch(`/api/v1/events/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; event?: ApiEventDetail }
      if (!r.ok) {
        setHostEditMsg(j.error ?? 'Could not save')
        return
      }
      if (j.event) setApiEvent(j.event)
      setHostEditMsg('Saved.')
    } catch {
      setHostEditMsg('Network error')
    } finally {
      setHostEditBusy(false)
    }
  }

  async function submitEventReview() {
    setEventReviewMsg(null)
    if (!UUID_PARAM_RE.test(id)) return
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(id)}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: eventReviewRating,
          body: eventReviewBody.trim() || undefined,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setEventReviewMsg(j.error ?? 'Could not submit review')
        return
      }
      setEventReviewMsg('Thanks. Your feedback was recorded.')
      setEventReviewBody('')
    } catch {
      setEventReviewMsg('Network error')
    }
  }

  if (UUID_PARAM_RE.test(id) && apiMode === 'loading') {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6" aria-busy="true" aria-live="polite">
        <div className="h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" />
        <div className="mt-6 h-10 max-w-md animate-pulse rounded-lg bg-dc-elevated-muted" />
      </div>
    )
  }

  const pageTitle = apiEvent?.title ?? mockEvent?.title ?? 'Event'
  const pageDesc =
    apiEvent?.description?.replace(/<[^>]+>/g, '').slice(0, 300) ??
    mockEvent?.description?.slice(0, 300)
  const eventCoverUrl =
    mediaDisplayUrl(apiEvent?.imageUrl) ??
    mediaDisplayUrl(mockEvent?.imageUrl) ??
    mediaDisplayUrl(mockEvent?.bannerUrl)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 overflow-x-hidden lg:pb-6">
      <ScopePageMeta
        title={pageTitle}
        description={pageDesc}
        path={`/events/${encodeURIComponent(id)}`}
        heroImageUrl={eventCoverUrl ?? null}
        bannerUrl={eventCoverUrl ?? null}
      />
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content. Reading column ~768px per design docs */}
        <main className="flex-1 min-w-0 w-full max-w-[768px] mx-auto lg:mx-0 lg:order-1">
          {/* Hero banner — visible on all viewports; compact on mobile */}
          <div className="relative -mx-4 sm:mx-0 overflow-hidden mb-6 rounded-none sm:rounded-2xl">
            <div className="aspect-[16/9] sm:aspect-[2/1] max-h-52 sm:max-h-none relative bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid">
              {eventCoverUrl ?
                <img src={eventCoverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-16 h-16 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 hidden p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent lg:block">
              <div className="flex flex-wrap gap-2 mb-2">
                <AlphaTestBadge label={apiEvent?.alphaLabel} />
                {isConventionSurface ?
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-dc-accent/25 text-dc-accent border border-dc-accent-border/30">
                    Convention
                  </span>
                : null}
                {!isConventionSurface && isVirtual ?
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/35">
                    Virtual · {virtualStyleLabel(virtualStyle)}
                  </span>
                : null}
                {!isConventionSurface && !isVirtual && apiMode === 'ready' ?
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-dc-elevated-muted text-dc-text-muted border border-dc-border">
                    In person
                  </span>
                : null}
                {!isConventionSurface && !isVirtual && apiMode === 'ready' && apiEvent?.newcomerFriendly ?
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                    Newcomer-friendly
                  </span>
                : null}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-dc-text">{event.title}</h1>
              <p className="text-dc-text-muted mt-1">{whenLine}</p>
              {hostTzLine && (
                <p className="text-xs text-dc-muted mt-1">Also {hostTzLine} (host timezone)</p>
              )}
              {countdownLabel && (
                <p className="text-xs text-sky-200/90 mt-1">{countdownLabel}</p>
              )}
              {isVirtual ?
                <p className="text-sm text-dc-muted mt-1">Online event</p>
              : (
                <p className="text-sm text-dc-muted flex items-start gap-1 mt-1">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span>
                    {apiMode === 'ready' && apiEvent ?
                      apiEvent.location?.trim() ?
                        apiEvent.location.trim()
                      : apiEvent.publicLocationSummary?.trim() ?
                        <>
                          <span className="text-dc-text">{apiEvent.publicLocationSummary.trim()}</span>
                          {apiEvent.locationRedacted ?
                            <span className="block text-xs text-dc-muted mt-0.5">
                              Street-level details unlock per host settings when you RSVP (and after approval if
                              required).
                            </span>
                          : null}
                        </>
                      : apiEvent.locationRedacted ?
                        'Location details unlock per host settings when you RSVP.'
                      : event.location
                    : event.location}
                  </span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-sm text-dc-muted">
                  {event.rsvpCount} going
                  {apiMode === 'ready' && typeof apiEvent?.capacityMax === 'number' ?
                    ` · cap ${apiEvent.capacityMax}`
                  : ''}
                </span>
              </div>
              {(orgSlug || groupLinkId) && (
                <div className="flex flex-wrap gap-2 mt-3" aria-label="Related organization and group">
                  {orgSlug && (
                    <Link
                      to={`/orgs/${encodeURIComponent(orgSlug)}`}
                      className="inline-flex min-h-touch items-center px-3 py-1.5 rounded-lg text-xs font-medium border border-dc-border-strong bg-dc-surface-muted/80 text-dc-text hover:border-dc-accent-border/40 hover:bg-dc-accent/10 transition-colors"
                    >
                      Organization
                    </Link>
                  )}
                  {groupLinkId && (
                    <Link
                      to={`/groups/${encodeURIComponent(groupLinkId)}`}
                      className="inline-flex min-h-touch items-center px-3 py-1.5 rounded-lg text-xs font-medium border border-dc-border-strong bg-dc-surface-muted/80 text-dc-text hover:border-dc-accent-border/40 hover:bg-dc-accent/10 transition-colors"
                    >
                      {getMockGroupById(groupLinkId)?.name ?? 'Group'}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mb-4 space-y-3 lg:hidden">
            <h1 className="text-2xl font-bold text-dc-text">{event.title}</h1>
            <EventDetailMobileFacts
              whenLine={whenLine}
              hostTzLine={hostTzLine}
              countdownLabel={countdownLabel}
              isVirtual={isVirtual}
              hostUsername={hostUsername}
              hostName={event.hostName}
              rsvpCount={event.rsvpCount}
              capacityMax={apiMode === 'ready' ? apiEvent?.capacityMax : null}
              formatBadges={
                <>
                  <AlphaTestBadge label={apiEvent?.alphaLabel} />
                  {isConventionSurface ?
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-dc-accent/25 text-dc-accent border border-dc-accent-border/30">
                      Convention
                    </span>
                  : null}
                  {!isConventionSurface && isVirtual ?
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/35">
                      Virtual · {virtualStyleLabel(virtualStyle)}
                    </span>
                  : null}
                  {!isConventionSurface && !isVirtual && apiMode === 'ready' ?
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-dc-elevated-muted text-dc-text-muted border border-dc-border">
                      In person
                    </span>
                  : null}
                </>
              }
              locationNode={
                isVirtual ?
                  <span>Online event</span>
                : apiMode === 'ready' && apiEvent ?
                  apiEvent.location?.trim() ?
                    apiEvent.location.trim()
                  : apiEvent.publicLocationSummary?.trim() ?
                    <>
                      <span className="text-dc-text">{apiEvent.publicLocationSummary.trim()}</span>
                      {apiEvent.locationRedacted ?
                        <span className="mt-1 block text-xs text-dc-muted">
                          Street-level details unlock per host settings when you RSVP.
                        </span>
                      : null}
                    </>
                  : apiEvent.locationRedacted ?
                    'Location details unlock per host settings when you RSVP.'
                  : event.location
                : event.location
              }
            />
            {rsvpClosed ?
              <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
                RSVPs are closed for this event.
              </p>
            : null}
            {apiMode === 'ready' && apiEvent && !rsvpLocked ?
              <EventRsvpPrivacyNote
                compact
                attendeeListVisibility={apiEvent.attendeeListVisibility}
                viewerIsHost={viewerIsHost}
                viewerIsGoing={rsvpKind === 'going'}
              />
            : null}
          </div>

          <div className="mb-6 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CopyLinkOverflowMenu path={`/events/${encodeURIComponent(id)}`} />
              {UUID_PARAM_RE.test(id) && apiMode === 'ready' && isAuthenticated ?
                (() => {
                  const target = eventTarget(id)
                  return (
                    <ReportAction
                      variant="button"
                      targetType={target.targetType}
                      targetId={target.targetId}
                      targetLabel="event"
                      surface="event_detail"
                      className={cn(cardSurfaceBaseClass, 'rounded-xl px-3 py-2 text-sm text-dc-muted hover:text-dc-accent min-h-10')}
                    />
                  )
                })()
              : null}
              {UUID_PARAM_RE.test(id) ?
                <EventSaveButton
                  eventId={id}
                  showLabel
                  className={cn(cardSurfaceBaseClass, 'rounded-xl text-dc-text')}
                />
              : null}
            </div>
            {viewerIsHost && hostEditDraft && UUID_PARAM_RE.test(id) && apiMode === 'ready' ?
              <details className={cn(cardSurfaceBaseClass, 'p-4 mt-4')}>
                <summary className="cursor-pointer text-sm font-medium text-dc-accent">
                  Edit event (host)
                </summary>
                <form className="mt-4 space-y-3 text-sm" onSubmit={(e) => void submitHostEdit(e)}>
                  <div>
                    <label htmlFor="host-edit-title" className="block text-xs text-dc-muted mb-1">
                      Title
                    </label>
                    <input
                      id="host-edit-title"
                      value={hostEditDraft.title}
                      onChange={(e) => setHostEditDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                      className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                    />
                  </div>
                  <div>
                    <label htmlFor="host-edit-desc" className="block text-xs text-dc-muted mb-1">
                      Description
                    </label>
                    <textarea
                      id="host-edit-desc"
                      rows={3}
                      value={hostEditDraft.description}
                      onChange={(e) => setHostEditDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                      className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                    />
                  </div>
                  <div>
                    <label htmlFor="host-edit-loc" className="block text-xs text-dc-muted mb-1">
                      {isVirtual ? 'Join link or platform hint' : 'Full address / venue'}
                    </label>
                    <input
                      id="host-edit-loc"
                      value={hostEditDraft.location}
                      onChange={(e) => setHostEditDraft((d) => (d ? { ...d, location: e.target.value } : d))}
                      className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                    />
                  </div>
                  {!isVirtual ?
                    <>
                      <div>
                        <label htmlFor="host-edit-vis" className="block text-xs text-dc-muted mb-1">
                          Address visibility
                        </label>
                        <select
                          id="host-edit-vis"
                          value={hostEditDraft.locationVisibility}
                          onChange={(e) =>
                            setHostEditDraft((d) =>
                              d ?
                                {
                                  ...d,
                                  locationVisibility: e.target.value as HostEditDraft['locationVisibility'],
                                }
                              : d
                            )
                          }
                          className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                        >
                          <option value="public">Public</option>
                          <option value="rsvp">After RSVP</option>
                          <option value="approved">After you approve</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="host-edit-pub" className="block text-xs text-dc-muted mb-1">
                          Public area hint (when address hidden)
                        </label>
                        <input
                          id="host-edit-pub"
                          value={hostEditDraft.publicLocationSummary}
                          onChange={(e) =>
                            setHostEditDraft((d) => (d ? { ...d, publicLocationSummary: e.target.value } : d))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                        />
                      </div>
                      <div>
                        <label htmlFor="host-edit-screen" className="block text-xs text-dc-muted mb-1">
                          Screening question (optional)
                        </label>
                        <input
                          id="host-edit-screen"
                          value={hostEditDraft.screeningQuestion}
                          onChange={(e) =>
                            setHostEditDraft((d) => (d ? { ...d, screeningQuestion: e.target.value } : d))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-dc-text-muted">
                        <input
                          type="checkbox"
                          className="rounded border-dc-border-strong"
                          checked={hostEditDraft.newcomerFriendly}
                          onChange={(e) =>
                            setHostEditDraft((d) => (d ? { ...d, newcomerFriendly: e.target.checked } : d))
                          }
                        />
                        Newcomer-friendly
                      </label>
                      <div>
                        <label htmlFor="host-edit-a11y" className="block text-xs text-dc-muted mb-1">
                          Accessibility notes
                        </label>
                        <textarea
                          id="host-edit-a11y"
                          rows={2}
                          value={hostEditDraft.accessibilityNotes}
                          onChange={(e) =>
                            setHostEditDraft((d) => (d ? { ...d, accessibilityNotes: e.target.value } : d))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                        />
                      </div>
                      <div>
                        <label htmlFor="host-edit-cap" className="block text-xs text-dc-muted mb-1">
                          Capacity max (optional)
                        </label>
                        <input
                          id="host-edit-cap"
                          type="number"
                          min={1}
                          value={hostEditDraft.capacityMax}
                          onChange={(e) =>
                            setHostEditDraft((d) => (d ? { ...d, capacityMax: e.target.value } : d))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                        />
                      </div>
                      <div>
                        <label htmlFor="host-edit-att" className="block text-xs text-dc-muted mb-1">
                          Guest list visibility
                        </label>
                        <select
                          id="host-edit-att"
                          value={hostEditDraft.attendeeListVisibility}
                          onChange={(e) =>
                            setHostEditDraft((d) =>
                              d ?
                                {
                                  ...d,
                                  attendeeListVisibility: e.target.value as HostEditDraft['attendeeListVisibility'],
                                }
                              : d
                            )
                          }
                          className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                        >
                          <option value="public">Names visible</option>
                          <option value="count_only">Counts only</option>
                        </select>
                      </div>
                    </>
                  : null}
                  <div>
                    <label htmlFor="host-edit-dress" className="block text-xs text-dc-muted mb-1">
                      Dress code
                    </label>
                    <input
                      id="host-edit-dress"
                      value={hostEditDraft.dressCode}
                      onChange={(e) => setHostEditDraft((d) => (d ? { ...d, dressCode: e.target.value } : d))}
                      className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                    />
                  </div>
                  <div>
                    <label htmlFor="host-edit-cost" className="block text-xs text-dc-muted mb-1">
                      Expected cost
                    </label>
                    <input
                      id="host-edit-cost"
                      value={hostEditDraft.expectedCostText}
                      onChange={(e) =>
                        setHostEditDraft((d) => (d ? { ...d, expectedCostText: e.target.value } : d))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                    />
                  </div>
                  {apiEvent?.organizationId ?
                    <div>
                      <label htmlFor="host-edit-price" className="block text-xs text-dc-muted mb-1">
                        Ticket price (USD, org Stripe Checkout)
                      </label>
                      <input
                        id="host-edit-price"
                        inputMode="decimal"
                        placeholder="e.g. 25.00 — leave blank for free / RSVP only"
                        value={hostEditDraft.priceDollars}
                        onChange={(e) =>
                          setHostEditDraft((d) => (d ? { ...d, priceDollars: e.target.value } : d))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-dc-text"
                      />
                      <p className="mt-1 text-xs text-dc-muted">
                        Uses the organization&apos;s payment settings (Stripe Connect, external link, or manual).
                        kink.social does not hold ticket funds.
                      </p>
                    </div>
                  : null}
                  {hostEditMsg ?
                    <div
                      className={`text-sm rounded-xl border px-3 py-2 ${
                        hostEditMsg === 'Saved.' ?
                          'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
                        : 'border-red-500/30 bg-red-950/25 text-red-200'
                      }`}
                      role={hostEditMsg === 'Saved.' ? 'status' : 'alert'}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <p className="flex-1">{hostEditMsg}</p>
                        {hostEditMsg !== 'Saved.' ?
                          <button
                            type="button"
                            onClick={() => setHostEditMsg(null)}
                            className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
                          >
                            Dismiss
                          </button>
                        : null}
                      </div>
                    </div>
                  : null}
                  <button
                    type="submit"
                    disabled={hostEditBusy}
                    className="min-h-11 px-4 py-2 rounded-xl bg-dc-accent text-dc-accent-foreground text-sm font-medium disabled:opacity-50"
                  >
                    {hostEditBusy ? 'Saving…' : 'Save changes'}
                  </button>
                </form>
              </details>
            : null}
          </div>

          {apiMode === 'ready' && apiEvent ?
            <EventSocialOrientation
              hostUsername={hostUsername}
              hostName={event.hostName}
              orgSlug={orgSlug ?? null}
              groupId={groupLinkId ?? null}
              groupName={groupLinkId ? getMockGroupById(groupLinkId)?.name ?? null : null}
              apiBacked={UUID_PARAM_RE.test(id)}
              hasDiscussionTab={hasDiscussionTab}
              timingStatus={eventTimingStatus}
              onSelectTab={selectTab}
            />
          : null}

          {/* Tabs */}
          <div className="relative -mx-4 sm:mx-0">
            <nav
              className="flex gap-1 overflow-x-auto pb-2 px-4 sm:px-0 c2k-no-scrollbar scroll-smooth snap-x snap-mandatory"
              aria-label="Event sections"
              role="tablist"
            >
              {eventTabs.map((tab) => (
                <TabButton
                  key={tab}
                  label={tab}
                  isActive={activeTab === tab}
                  onClick={() => selectTab(tab)}
                  className="shrink-0 snap-start whitespace-nowrap"
                />
              ))}
            </nav>
            <div
              className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-dc-surface to-transparent sm:hidden"
              aria-hidden
            />
          </div>

          <div className="mt-6">
            {activeTab === 'Overview' && (
              <ContentSection className="space-y-6">
                {isConventionSurface && apiEvent?.conventionSlug && (
                  <div className="rounded-xl border border-dc-accent-border/30 bg-dc-accent/10 p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-dc-accent uppercase">Convention</h3>
                    <p className="text-sm text-dc-text-muted">
                      This listing is the anchor for a multi-day program. Use the schedule for rooms, sessions, and
                      presenters. The event page is for overview, tickets, and logistics.
                    </p>
                    <Link
                      to={`/conventions/${encodeURIComponent(apiEvent.conventionSlug)}?tab=Schedule`}
                      className="inline-flex min-h-11 items-center px-4 py-2 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover"
                    >
                      Open convention hub
                    </Link>
                  </div>
                )}
                {apiMode === 'ready' && contributors.length > 0 && (
                  <div className="rounded-xl border border-dc-border bg-dc-elevated-solid p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-dc-muted uppercase">Partners &amp; contributors</h3>
                    <p className="text-xs text-dc-muted">
                      Vendors, sponsors, and tabling partners for this event (from the anchor event roster). Session-level
                      presenters appear on the convention schedule.
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {contributors.map((c) => (
                        <li key={c.id}>
                          {c.vendorSlug ?
                            <Link
                              to={`/vendors/${encodeURIComponent(c.vendorSlug)}`}
                              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text hover:border-dc-accent-border/40"
                            >
                              <span className="text-[10px] uppercase tracking-wide text-dc-muted">{c.kind}</span>
                              <span className="truncate font-medium">{c.label}</span>
                            </Link>
                          : c.username ?
                            <Link
                              to={`/profile/${encodeURIComponent(c.username)}`}
                              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text hover:border-dc-accent-border/40"
                            >
                              <span className="text-[10px] uppercase tracking-wide text-dc-muted">{c.kind}</span>
                              <span className="truncate font-medium">{c.label}</span>
                            </Link>
                          : <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text-muted">
                              <span className="text-[10px] uppercase tracking-wide text-dc-muted">{c.kind}</span>
                              <span className="truncate font-medium text-dc-text">{c.label}</span>
                            </span>
                          }
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {isVirtual && (virtualJoinUrl || virtualPlatformHint || joinLinkGated) && (
                  <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-dc-muted uppercase">Join online</h3>
                    {joinLinkGated ?
                      <p className="text-sm text-dc-text-muted">
                        RSVP <strong className="text-dc-text">Going</strong> or{' '}
                        <strong className="text-dc-text">{RSVP_LABEL_INTERESTED}</strong>{' '}
                        to reveal the video link (helps reduce drive-by link sharing). Platform: external Zoom, Meet, or
                        similar. Have it installed or ready in your browser.
                      </p>
                    : virtualJoinUrl ?
                      <>
                        <p className="text-xs text-dc-muted">
                          Opens in a new tab. Confirm recording and privacy expectations with the host.
                        </p>
                        <a
                          href={virtualJoinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center px-4 py-2 rounded-xl text-sm font-medium bg-sky-600 text-dc-text hover:bg-sky-500"
                        >
                          Open join link
                        </a>
                      </>
                    : (
                      <p className="text-sm text-dc-text-muted">
                        Platform / tool: <span className="text-dc-text">{virtualPlatformHint}</span>. The host will share
                        the exact link before the start time (often after you RSVP).
                      </p>
                    )}
                  </div>
                )}
                {showEducationBlocks && apiEvent?.materialsUrl?.trim() && (
                  <div className="rounded-xl border border-dc-border bg-dc-elevated-solid p-4">
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Materials</h3>
                    <a
                      href={apiEvent.materialsUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center px-4 py-2 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover"
                    >
                      Open materials
                    </a>
                  </div>
                )}
                {showEducationBlocks && recordingPolicyLabel(apiEvent?.recordingPolicy ?? null) && (
                  <div className="rounded-xl border border-dc-border bg-dc-elevated-solid p-4">
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Recording</h3>
                    <p className="text-sm text-dc-text-muted">
                      {recordingPolicyLabel(apiEvent?.recordingPolicy ?? null)}
                    </p>
                  </div>
                )}
                {showEducationBlocks && apiEvent?.virtualAgenda?.trim() && (
                  <div className="rounded-xl border border-dc-border bg-dc-elevated-solid p-4">
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Agenda</h3>
                    <p className="text-sm text-dc-text-muted whitespace-pre-wrap">{apiEvent.virtualAgenda.trim()}</p>
                  </div>
                )}
                {showEducationBlocks && programSummary && apiEvent?.conventionSlug && (
                  <div className="rounded-xl border border-dc-accent/25 bg-dc-accent/5 p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-dc-muted uppercase">Full program</h3>
                    <p className="text-xs text-dc-muted">
                      {programSummary.name} · {programSummary.slotCount} slot
                      {programSummary.slotCount === 1 ? '' : 's'} on the schedule.
                    </p>
                    <Link
                      to={`/conventions/${encodeURIComponent(apiEvent.conventionSlug)}?tab=Schedule`}
                      className="inline-flex min-h-11 items-center px-4 py-2 rounded-xl text-sm font-medium bg-dc-elevated-muted text-dc-text hover:bg-white/15 border border-dc-border"
                    >
                      View schedule
                    </Link>
                  </div>
                )}
                {showTicketsSection && (
                  <div className="rounded-xl border border-dc-accent/25 bg-dc-accent/5 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-dc-muted uppercase">Tickets</h3>
                    {hasOrgTicketPrice && priceCents != null ?
                      <p className="text-sm text-dc-text">
                        {(priceCents / 100).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'USD',
                        })}
                        {apiEvent?.viewerPaidConfirmed ? ' · Paid' : null}
                      </p>
                    : null}
                    {payMsg ?
                      <p className="text-xs text-dc-muted" role="status">
                        {payMsg}
                      </p>
                    : null}
                    {hasOrgTicketPrice && payments?.processor === 'external' && payments.externalPaymentUrl ?
                      <>
                        <PaymentsBuyerDisclaimer variant="short" />
                        <a
                          href={payments.externalPaymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center px-4 py-2 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover"
                        >
                          Open payment page
                        </a>
                      </>
                    : null}
                    {hasOrgTicketPrice &&
                    (payments?.processor === 'manual' ||
                      (payments?.processor === 'external' && !payments.externalPaymentUrl)) ?
                      <>
                        <p className="text-xs text-dc-muted">
                          Online checkout is not enabled. Pay at the door or follow the host&apos;s instructions; the
                          organizer confirms paid access.
                        </p>
                        <PaymentsBuyerDisclaimer variant="short" />
                      </>
                    : null}
                    {hasOrgTicketPrice && (!payments || payments.processor === 'stripe') ?
                      <>
                        <PaymentsBuyerDisclaimer variant="short" />
                        {apiEvent?.viewerPaidConfirmed ?
                          <p className="text-xs text-emerald-200/90">Your payment is confirmed for this event.</p>
                        : isAuthenticated ?
                          <button
                            type="button"
                            disabled={payBusy || payments?.stripeReady === false}
                            onClick={() => {
                              void (async () => {
                                setPayBusy(true)
                                setPayMsg(null)
                                try {
                                  const url = await startEventCheckout(id)
                                  window.location.href = url
                                } catch (e) {
                                  setPayMsg(e instanceof Error ? e.message : 'Checkout failed')
                                } finally {
                                  setPayBusy(false)
                                }
                              })()
                            }}
                            className="inline-flex min-h-11 items-center px-4 py-2 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
                          >
                            {payBusy ? 'Starting checkout…' : 'Pay with Stripe'}
                          </button>
                        : (
                          <Link
                            to={buildLoginHref(pathname)}
                            className="inline-flex min-h-11 items-center px-4 py-2 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover"
                          >
                            Sign in to pay
                          </Link>
                        )}
                        {payments?.stripeReady === false ?
                          <p className="text-xs text-amber-200/85">
                            The organizer has not finished Stripe Connect setup yet.
                          </p>
                        : null}
                      </>
                    : null}
                    {!hasOrgTicketPrice ?
                      <p className="text-xs text-dc-muted">
                        Checkout happens on the ticket provider&apos;s site. kink.social does not process these
                        payments.
                      </p>
                    : null}
                    {ticketPurchaseUrl && (
                      <a
                        href={ticketPurchaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center px-4 py-2 rounded-xl text-sm font-medium bg-dc-elevated-muted text-dc-text hover:bg-white/15 border border-dc-border"
                      >
                        Buy tickets (external)
                      </a>
                    )}
                    {showTicketEmbed && ticketEmbedUrl && (
                      <div className="space-y-2">
                        <p className="text-xs text-dc-muted">Embedded checkout (third-party)</p>
                        <iframe
                          title="Ticket checkout"
                          src={ticketEmbedUrl}
                          className="w-full min-h-[420px] rounded-lg border border-dc-border bg-black/20"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    )}
                  </div>
                )}
                {apiMode === 'ready' &&
                  apiEvent?.hasProgram &&
                  apiEvent.conventionSlug &&
                  !(showEducationBlocks && programSummary) && (
                  <div className="rounded-xl border border-dc-border bg-dc-elevated-solid p-4">
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Program schedule</h3>
                    <p className="text-xs text-dc-muted mb-3">
                      {isConventionSurface ?
                        'Sessions, rooms, and times live on the convention hub.'
                      : 'Full program with times and sessions'}
                      {typeof apiEvent.programSlotCount === 'number' && apiEvent.programSlotCount > 0
                        ? ` (${apiEvent.programSlotCount} slot${apiEvent.programSlotCount === 1 ? '' : 's'})`
                        : ''}
                      .
                    </p>
                    <Link
                      to={`/conventions/${encodeURIComponent(apiEvent.conventionSlug)}?tab=Schedule`}
                      className="inline-flex min-h-11 items-center px-4 py-2 rounded-xl text-sm font-medium bg-dc-elevated-muted text-dc-text hover:bg-white/15 border border-dc-border"
                    >
                      {isConventionSurface ? 'View schedule' : 'View full schedule'}
                    </Link>
                  </div>
                )}
                {event.expectedCostText && (
                  <div>
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Expected cost</h3>
                    <p className="text-dc-text-muted">{event.expectedCostText}</p>
                  </div>
                )}
                {apiMode === 'ready' && apiEvent?.accessibilityNotes?.trim() && (
                  <div>
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Accessibility</h3>
                    <p className="text-dc-text-muted whitespace-pre-wrap">{apiEvent.accessibilityNotes.trim()}</p>
                  </div>
                )}
                {viewerIsHost && apiMode === 'ready' && apiEvent && (apiEvent.pendingRsvpApprovals ?? 0) > 0 ?
                  <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-amber-200 uppercase">RSVP approvals</h3>
                      <p className="text-xs text-dc-muted">
                        Guests marked <strong className="text-dc-text">Going</strong> need approval before they see the
                        full address.
                      </p>
                      <ul className="space-y-2">
                        {rsvpQueue
                          .filter((r) => r.status === 'going' && r.rsvpApprovalStatus === 'pending')
                          .map((r) => (
                            <li
                              key={r.userId}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-dc-border bg-dc-elevated-solid p-3"
                            >
                              <div className="min-w-0 text-sm">
                                <p className="text-dc-text font-medium truncate">
                                  {r.displayName ?? r.username}
                                </p>
                                {r.screeningAnswer?.trim() ?
                                  <p className="text-xs text-dc-muted mt-1 break-words">
                                    {r.screeningAnswer.trim()}
                                  </p>
                                : null}
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={rsvpQueueBusy}
                                  onClick={() => void runApproval(r.userId, 'approve')}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dc-success/20 text-dc-success border border-dc-success/40 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={rsvpQueueBusy}
                                  onClick={() => void runApproval(r.userId, 'reject')}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dc-surface-muted border border-dc-border text-dc-text-muted disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            </li>
                          ))}
                      </ul>
                  </div>
                : null}
                <div>
                  <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Description</h3>
                  <p className="text-dc-text-muted">{event.description}</p>
                </div>
                {isVirtual && (virtualStyle === 'social' || virtualStyle === 'mixed') ?
                  <div>
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Social video etiquette</h3>
                    <div className="prose prose-invert prose-sm max-w-none text-dc-text-muted rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                      <p>
                        <strong>Vibe:</strong> low pressure. Cameras on or off per your comfort unless the host says
                        otherwise. <strong>Consent:</strong> same boundaries online; ask before DMing or recording.{' '}
                        <strong>Chat:</strong> stay in public chat unless invited elsewhere. Moderators may remove
                        disruptors.
                      </p>
                      <p className="mt-2">
                        <Link to="/guidelines" className="text-dc-accent hover:underline">
                          Community guidelines
                        </Link>
                      </p>
                    </div>
                  </div>
                : null}
                {isVirtual && (virtualStyle === 'education' || virtualStyle === 'mixed') ?
                  <div>
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Class / webinar etiquette</h3>
                    <div className="prose prose-invert prose-sm max-w-none text-dc-text-muted rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
                      <p>
                        <strong>Focus:</strong> mute when not speaking; use raise-hand or chat Q&amp;A if the host asks.{' '}
                        <strong>Recording:</strong> follow the recording notice above. Do not record without permission.{' '}
                        <strong>Materials:</strong> personal use only unless the host specifies otherwise.
                      </p>
                    </div>
                  </div>
                : null}
                {!isVirtual && isConventionSurface ?
                  <div>
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Venue &amp; play-space etiquette</h3>
                    <div className="prose prose-invert prose-sm max-w-none text-dc-text-muted rounded-xl border border-amber-500/35 bg-amber-500/5 p-4">
                      <p>
                        <strong>Photos:</strong> ask every time. <strong>Intoxication:</strong> staff may turn you away.{' '}
                        <strong>Scenes:</strong> use red/yellow/green; dungeon monitors can pause any scene for safety.
                      </p>
                    </div>
                  </div>
                : null}
                {!isVirtual && !isConventionSurface ?
                  <div>
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Community etiquette</h3>
                    <div className="prose prose-invert prose-sm max-w-none text-dc-text-muted rounded-xl border border-dc-border bg-dc-elevated-solid p-4">
                      <p>
                        <strong>Consent</strong> is ongoing and specific. <strong>Respect</strong> venue rules and staff.{' '}
                        <strong>Photos</strong> only with clear permission. When in doubt, ask the host.
                      </p>
                    </div>
                  </div>
                : null}
                <div>
                  <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Rules</h3>
                  <p className="text-dc-text-muted">{event.rules}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Dress code</h3>
                  <p className="text-dc-text-muted">{event.dressCode}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Consent policy</h3>
                  <p className="text-dc-text-muted">{event.consentPolicy}</p>
                </div>
                <p className="text-sm text-dc-muted">
                  Hosted by{' '}
                  {hostUsername ?
                    <Link to={`/profile/${encodeURIComponent(hostUsername)}`} className="text-dc-accent hover:underline">
                      {event.hostName}
                    </Link>
                  : (
                    event.hostName
                  )}
                </p>
                {apiMode === 'ready' && apiEvent?.organizationId && (
                  <div className="mt-6 pt-6 border-t border-dc-border">
                    <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Event feedback</h3>
                    <p className="text-xs text-dc-muted mb-3">
                      One review per account. Staff of the host organization cannot submit here.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <label htmlFor="ev-rating" className="text-sm text-dc-text-muted">
                        Rating
                      </label>
                      <select
                        id="ev-rating"
                        value={eventReviewRating}
                        onChange={(e) => setEventReviewRating(Number(e.target.value))}
                        className="bg-dc-elevated-solid border border-dc-border rounded-lg text-sm text-dc-text px-2 py-1"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} stars
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={eventReviewBody}
                      onChange={(e) => setEventReviewBody(e.target.value)}
                      placeholder="Optional comment"
                      rows={3}
                      className="w-full bg-dc-elevated-solid border border-dc-border rounded-xl text-sm text-dc-text-muted p-3 mb-2"
                    />
                    <button
                      type="button"
                      onClick={() => void submitEventReview()}
                      className={cn(cardSurfaceBaseClass, 'min-h-11 px-4 py-2 rounded-xl text-sm font-medium text-dc-text hover:border-dc-accent-border/40')}
                    >
                      Submit review
                    </button>
                    {eventReviewMsg ?
                      <div
                        className={`mt-2 text-sm rounded-xl border px-3 py-2 ${
                          eventReviewMsg.startsWith('Thanks') ?
                            'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
                          : 'border-red-500/30 bg-red-950/25 text-red-200'
                        }`}
                        role={eventReviewMsg.startsWith('Thanks') ? 'status' : 'alert'}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <p className="flex-1">{eventReviewMsg}</p>
                          {!eventReviewMsg.startsWith('Thanks') ?
                            <button
                              type="button"
                              onClick={() => setEventReviewMsg(null)}
                              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
                            >
                              Dismiss
                            </button>
                          : null}
                        </div>
                      </div>
                    : null}
                  </div>
                )}
              </ContentSection>
            )}

            {activeTab === 'Attendees' && (
              <ContentSection>
                {isApiEventRoute && apiMode === 'ready' && attendeesPayload ?
                  <>
                    <p className="text-sm text-dc-muted mb-4">
                      {attendeesPayload.goingCount} going · {attendeesPayload.maybeCount} interested ·{' '}
                      {attendeesPayload.waitlistCount} waitlist
                      {attendeesPayload.attendeeListVisibility === 'count_only' && !viewerIsHost ?
                        ' · names hidden (host chose count-only list)'
                      : ''}
                    </p>
                    {attendeesPayload.items.length > 0 ?
                      <ul className="space-y-3">
                        {attendeesPayload.items.map((person) => (
                          <li key={person.userId}>
                            <Link
                              to={`/profile/${encodeURIComponent(person.username)}`}
                              className="flex items-center gap-3 rounded-xl border border-dc-border p-3 hover:border-dc-accent-border/40 transition-colors"
                            >
                              <PlaceholderAvatar size="sm" className="!rounded-full flex-shrink-0" />
                              <div className="min-w-0 text-left">
                                <p className="font-medium text-dc-text truncate">
                                  {person.displayName ?? person.username}
                                </p>
                                <p className="text-xs text-dc-muted">Going</p>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    : (
                      <p className="text-sm text-dc-text-muted">
                        {attendeesPayload.attendeeListVisibility === 'count_only' && !viewerIsHost ?
                          'The host chose to show counts only.'
                        : 'No public “going” RSVPs yet.'}
                      </p>
                    )}
                  </>
                : (
                  <>
                    <p className="text-sm text-dc-muted mb-4">
                      Preview attendees (mock). Open a database-backed event UUID to load the live list.
                    </p>
                    <ul className="space-y-3">
                      {attendeePreview.map((person) => (
                        <li key={person.username}>
                          <Link
                            to={`/profile/${person.username}`}
                            className="flex items-center gap-3 rounded-xl border border-dc-border p-3 hover:border-dc-accent-border/40 transition-colors"
                          >
                            <PlaceholderAvatar size="sm" className="!rounded-full flex-shrink-0" />
                            <div className="min-w-0 text-left">
                              <p className="font-medium text-dc-text truncate">{person.username}</p>
                              <p className="text-xs text-dc-muted">RSVP · mock</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </ContentSection>
            )}

            {activeTab === 'Vendors' && (
              <ContentSection>
                {isApiEventRoute && apiMode === 'ready' ?
                  <>
                    {contributors.length > 0 ?
                      <>
                        <h3 className="text-sm font-semibold text-dc-muted uppercase mb-3">Contributors &amp; tabling</h3>
                        <ul className="space-y-2">
                          {contributors.map((c) => (
                            <li key={c.id} className="rounded-xl border border-dc-border p-3 text-left">
                              <p className="text-xs text-dc-muted uppercase">{c.kind}</p>
                              {c.vendorSlug ?
                                <Link
                                  to={`/vendors/${encodeURIComponent(c.vendorSlug)}`}
                                  className="font-medium text-dc-text hover:text-dc-accent"
                                >
                                  {c.label}
                                </Link>
                              : c.username ?
                                <Link
                                  to={`/profile/${encodeURIComponent(c.username)}`}
                                  className="font-medium text-dc-text hover:text-dc-accent"
                                >
                                  {c.label}
                                </Link>
                              : <p className="font-medium text-dc-text">{c.label}</p>
                              }
                              {c.description && <p className="text-sm text-dc-text-muted mt-1">{c.description}</p>}
                            </li>
                          ))}
                        </ul>
                      </>
                    : (
                      <p className="text-sm text-dc-text-muted">
                        No vendors, tabling partners, or contributors are listed for this event. Larger events like
                        conventions usually surface that on the program hub.
                      </p>
                    )}
                  </>
                : (
                  <>
                    <p className="text-sm text-dc-muted mb-4">Demo vendors (mock sample).</p>
                    <ul className="space-y-3">
                      {vendorPreview.map((v) => (
                        <li key={v.id}>
                          <Link
                            to={`/vendors/${v.id}`}
                            className="block rounded-xl border border-dc-border p-4 hover:border-dc-accent-border/40 transition-colors text-left"
                          >
                            <p className="font-medium text-dc-text">{v.name}</p>
                            <p className="text-xs text-dc-muted mt-1">{v.shipsTo} · demo</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </ContentSection>
            )}

            {activeTab === 'Schedule' && apiMode === 'ready' && apiEvent?.hasProgram && apiEvent.conventionSlug && (
              <div className="space-y-4 text-left">
                <div className="rounded-2xl border border-dc-accent/25 bg-dc-accent/5 p-4">
                  <p className="text-sm text-dc-text-muted">
                    Same program as the linked convention. Switch <strong className="text-dc-text">Cards</strong> vs{' '}
                    <strong className="text-dc-text">Time list</strong> for a Sched-style dense view. Use the hub for chat,
                    documents, and staff tools.
                  </p>
                </div>
                <ContentSection>
                  <ConventionProgramSchedulePanel conventionSlug={apiEvent.conventionSlug} />
                </ContentSection>
              </div>
            )}

            {activeTab === 'Matchmaker' && UUID_PARAM_RE.test(id) && apiMode === 'ready' && (
              <ContentSection className="text-left">
                <EventMatchmakerPanel eventId={id} />
              </ContentSection>
            )}

            {activeTab === 'Discussion' && (
              <ContentSection className="text-left">
                {UUID_PARAM_RE.test(id) ?
                  <EventDiscussionPanel eventId={id} />
                : <p className="text-sm text-dc-muted">Discussion is available for live events after you open an event from the calendar.</p>}
              </ContentSection>
            )}

            {activeTab === 'Safety Info' && (
              <ContentSection className="text-left space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Consent &amp; boundaries</h3>
                  <p className="text-sm text-dc-text-muted">{event.consentPolicy}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Venue rules</h3>
                  <p className="text-sm text-dc-text-muted">{event.rules}</p>
                </div>
                <ul className="text-sm text-dc-text-muted space-y-2 list-disc pl-5">
                  <li>Use safewords and check in with partners throughout scenes.</li>
                  <li>Staff and dungeon monitors can stop any scene for safety.</li>
                  <li>
                    Need help?{' '}
                    <Link to="/support" className="text-dc-accent hover:underline">
                      Support
                    </Link>{' '}
                    and reporting tools will connect to moderation when live.
                  </li>
                </ul>
              </ContentSection>
            )}
          </div>
        </main>

        {/* Sticky RSVP card — desktop sidebar; mobile uses MobileActionBar */}
        <aside className="hidden lg:block w-full flex-shrink-0 lg:order-2 lg:w-80">
          <ContentSection padding="sidebar" className="lg:sticky lg:top-24 dc-card-polish">
            <h2 className="hidden lg:block text-lg font-semibold text-dc-text mb-2">{event.title}</h2>
            <p className="hidden lg:block text-sm text-dc-text-muted">{whenLine}</p>
            <p className="hidden lg:block text-sm text-dc-muted mt-1">
              {isVirtual ?
                'Online'
              : apiMode === 'ready' && apiEvent ?
                apiEvent.location?.trim() ?
                  apiEvent.location.trim()
                : apiEvent.publicLocationSummary?.trim() ?
                  apiEvent.publicLocationSummary.trim()
                : apiEvent.locationRedacted ?
                  'Location unlocks per host rules'
                : event.location
              : event.location}
            </p>
            <p className="text-sm text-dc-accent mt-2">
              {event.rsvpCount} going
              {apiMode === 'ready' && typeof apiEvent?.capacityMax === 'number' ?
                ` · cap ${apiEvent.capacityMax}`
              : ''}
            </p>
            {rsvpClosed ?
              <p className="text-sm text-amber-200/90 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                RSVPs are closed. You can still cancel an existing RSVP with Can&apos;t go.
              </p>
            : null}
            {apiMode === 'ready' && apiEvent?.screeningQuestion?.trim() && isAuthenticated && !rsvpLocked && !rsvpClosed ?
              <div className="mt-3">
                <label htmlFor="ev-screening" className="block text-xs text-dc-muted mb-1">
                  Host question (Going / {RSVP_LABEL_INTERESTED})
                </label>
                <input
                  ref={screeningAnswerRef}
                  id="ev-screening"
                  type="text"
                  autoComplete="off"
                  placeholder="Your answer"
                  className="w-full px-3 py-2 rounded-xl bg-dc-elevated-solid border border-dc-border text-sm text-dc-text placeholder-dc-muted"
                />
              </div>
            : null}
            {rsvpMsg ?
              <div
                className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200 mt-2"
                role="alert"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="flex-1">{rsvpMsg}</p>
                  <button
                    type="button"
                    onClick={() => setRsvpMsg(null)}
                    className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            : null}
            {apiMode === 'ready' && apiEvent?.viewerRsvpApprovalStatus === 'pending' ?
              <p className="text-xs text-amber-200 mt-2">
                Host approval pending. Full address appears after you’re approved.
              </p>
            : null}
            {rsvpKind === 'waitlist' ?
              <p className="text-xs text-violet-200 mt-2">
                You’re on the waitlist. If a spot opens, you’ll be moved up automatically.
              </p>
            : null}
            {apiMode === 'ready' && apiEvent && !rsvpLocked ?
              <EventRsvpPrivacyNote
                className="mt-4"
                attendeeListVisibility={apiEvent.attendeeListVisibility}
                viewerIsHost={viewerIsHost}
                viewerIsGoing={rsvpKind === 'going'}
              />
            : null}
            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                onClick={() => void putRsvp('going')}
                disabled={rsvpBusy || rsvpLocked}
                className={`w-full min-h-11 px-4 py-3 rounded-xl text-sm font-medium border disabled:opacity-50 disabled:cursor-not-allowed ${
                  rsvpKind === 'waitlist' ?
                    'bg-violet-500/15 text-violet-100 border-violet-400/35'
                  : rsvpKind === 'going' && apiEvent?.viewerRsvpApprovalStatus === 'pending' ?
                    'bg-amber-500/15 text-amber-100 border-amber-400/40'
                  : rsvpKind === 'going' ?
                    'bg-dc-success/20 text-dc-success border-dc-success/40'
                  : 'bg-dc-accent hover:bg-dc-accent-hover text-dc-accent-foreground border-transparent'
                }`}
              >
                {rsvpKind === 'waitlist' ? 'On waitlist' : 'Going'}
              </button>
              <button
                type="button"
                onClick={() => void putRsvp('maybe')}
                disabled={rsvpBusy || rsvpLocked}
                className={`w-full min-h-11 px-4 py-3 rounded-xl text-sm font-medium border disabled:opacity-50 disabled:cursor-not-allowed ${
                  rsvpKind === 'maybe' ?
                    'bg-amber-500/15 text-amber-200 border-amber-500/40'
                  : 'bg-dc-elevated-solid border-dc-border text-dc-text-muted hover:text-dc-text'
                }`}
              >
                {RSVP_LABEL_INTERESTED}
              </button>
              <button
                type="button"
                onClick={() => void putRsvp('not_going')}
                disabled={rsvpBusy || rsvpLocked}
                className="w-full min-h-11 px-4 py-3 rounded-xl text-sm font-medium bg-dc-elevated-solid border border-dc-border text-dc-muted hover:text-dc-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Can&apos;t go
              </button>
            </div>
            {rsvpLocked ?
              <p className="text-xs text-dc-muted mt-2">Sign in to RSVP.</p>
            : null}
            {isApiEventRoute && apiMode === 'ready' && isAuthenticated && calendarLinks && (rsvpKind === 'going' || rsvpKind === 'maybe' || rsvpKind === 'waitlist') && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-dc-muted">Add to calendar</p>
                <a
                  href={calendarLinks.googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 w-full items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
                >
                  Google Calendar
                </a>
                <a
                  href={calendarLinks.webcalUrl}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
                >
                  Apple Calendar (subscribe)
                </a>
                <a
                  href={calendarLinks.icsUrl}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
                >
                  Download .ics (Outlook &amp; others)
                </a>
              </div>
            )}
          </ContentSection>
        </aside>
      </div>

      <MobileActionBar
        className="lg:hidden border-t border-dc-border/90"
        status={
          rsvpClosed ? 'RSVPs closed'
          : rsvpLocked ? 'Sign in to save your spot'
          : rsvpKind === 'going' ?
            `${event.rsvpCount} going · You're going`
          : rsvpKind === 'maybe' ?
            `${event.rsvpCount} going · ${RSVP_LABEL_INTERESTED}`
          : rsvpKind === 'waitlist' ?
            'On waitlist'
          : `${event.rsvpCount} going`
        }
        primary={{
          label:
            rsvpLocked ? 'Sign in to RSVP'
            : rsvpKind === 'waitlist' ? 'On waitlist'
            : rsvpKind === 'going' ? 'Going'
            : 'RSVP Going',
          href: rsvpLocked ? buildLoginHref(pathname) : undefined,
          onClick: rsvpLocked ? undefined : () => void putRsvp('going'),
          disabled: rsvpBusy || rsvpClosed || rsvpKind === 'waitlist',
        }}
        secondary={
          !rsvpLocked && !rsvpClosed ?
            {
              label: RSVP_LABEL_INTERESTED,
              onClick: () => void putRsvp('maybe'),
              disabled: rsvpBusy || rsvpKind === 'maybe',
              variant: 'secondary' as const,
            }
          : undefined
        }
      />
    </div>
  )
}
