/**
 * Public convention hub payload for `/conventions/[slug]` (program, settings, hero).
 *
 * Fetches hub APIs with credentials; `slug` required to enable loads. Exposes schedule
 * slots, attendee guide, theme CSS vars, and preview-role overrides for organizer preview.
 * Prefer this over page-local fetch — keep the convention page a thin consumer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConventionHeroPreviewRole } from '@/components/conventions/ConventionHero'
import type { HostedByOrg } from '@/components/conventions/HostedByCard'
import type { ScheduleSlot } from '@/components/conventions/convention-schedule-types'
import { dayHeading, sortSlotsForAgenda } from '@/components/conventions/convention-schedule-utils'
import {
  parseAttendeeGuideJson,
  publicAttendeeGuideJson,
  publicAttendeeGuideHasContent,
  type PublicAttendeeGuide,
} from '@/lib/dancecard/attendeeGuideJson'
import { parseThemeConfig, themeConfigToCssVars } from '@/lib/dancecard/theme'

export type ConventionSettings = {
  venueProfile?: string
  hotelBlocks?: Array<{ label: string; url?: string; code?: string }>
  cocUrl?: string
  safetyReportingNote?: string
  accessibilityVenueNotes?: string
  publicProgramListing?: boolean
  isoBoardEnabled?: boolean
  programStaffAttendeeRoles?: string[]
  /** Public listing extras (website / venue name) — already returned by the hub API. */
  eckeListing?: {
    highlights?: string[]
    venueName?: string | null
    websiteUrl?: string | null
  }
  dancecardSlug?: string
  dancecardHost?: string
  dancecardEnabled?: boolean
  dancecardEmbedTokenHint?: string
  dancecardAttendeeSameTab?: boolean
  shareImageUrl?: string | null
  eventSystems?: {
    productTitle?: string | null
    eventTitle?: string | null
    sharedByLabel?: string | null
    sharedByDetail?: string | null
    logoUrl?: string | null
    badgeLogoUrl?: string | null
    themeConfig?: Record<string, unknown> | null
    attendeeGuideJson?: Record<string, unknown> | null
  } | null
}

export type ContributorPreview = {
  id: string
  kind: string
  label: string
  vendorSlug: string | null
  username: string | null
}

export type ConvRow = {
  id: string
  name: string
  description: string | null
  anchorEventId: string | null
  organizationId: string | null
  timezone: string
  startsAt: string
  endsAt: string
  settings?: ConventionSettings | null
}

export type ConventionAccess = {
  canView: boolean
  canManage: boolean
  hasPaidAccess: boolean
  isStaff: boolean
  previewRole?: ConventionHeroPreviewRole | null
}

export type ConventionHubDoc = { id: string; title: string; type: string; url: string }
export type ConventionHubPage = { id: string; title: string; slug: string; content: Record<string, unknown> }
export type ConventionHubChannel = {
  id: string
  slug: string
  name: string
  kind: string
  sortOrder: number
}

export type LogisticsDraft = {
  venueProfile: string
  cocUrl: string
  safetyReportingNote: string
  accessibilityVenueNotes: string
  hotelBlocksText: string
  publicProgramListing: boolean
  programStaffAttendeeRolesText: string
  dancecardSlug: string
  dancecardHost: string
  dancecardEnabled: boolean
  dancecardEmbedTokenHint: string
  dancecardAttendeeSameTab: boolean
}

export type MyScheduleItem = {
  kind: string
  startsAt: string
  endsAt: string
  title: string
  detail?: string
  location?: string | null
}

function logisticsDraftFromSettings(s: ConventionSettings | null | undefined): LogisticsDraft {
  const roles = s?.programStaffAttendeeRoles
  return {
    venueProfile: s?.venueProfile ?? '',
    cocUrl: s?.cocUrl ?? '',
    safetyReportingNote: s?.safetyReportingNote ?? '',
    accessibilityVenueNotes: s?.accessibilityVenueNotes ?? '',
    hotelBlocksText: s?.hotelBlocks?.length ? JSON.stringify(s.hotelBlocks, null, 2) : '',
    publicProgramListing: s?.publicProgramListing !== false,
    programStaffAttendeeRolesText: Array.isArray(roles) && roles.length ? roles.join(', ') : '',
    dancecardSlug: s?.dancecardSlug ?? '',
    dancecardHost: s?.dancecardHost ?? '',
    dancecardEnabled: s?.dancecardEnabled === true,
    dancecardEmbedTokenHint: s?.dancecardEmbedTokenHint ?? '',
    dancecardAttendeeSameTab: s?.dancecardAttendeeSameTab === true,
  }
}

function applyConventionPayload(
  d1: {
    convention: ConvRow
    organizationSummary: HostedByOrg | null
    anchorEventSummary: {
      id: string
      title: string
      imageUrl: string | null
      locationLabel?: string | null
    } | null
    contributorsPreview?: ContributorPreview[]
    isPinned?: boolean
  },
  setters: {
    setConv: (v: ConvRow) => void
    setOrganizationSummary: (v: HostedByOrg | null) => void
    setIsPinned: (v: boolean) => void
    setAnchorEventSummary: (
      v: { id: string; title: string; imageUrl: string | null; locationLabel?: string | null } | null,
    ) => void
    setContributorsPreview: (v: ContributorPreview[]) => void
    setLogisticsDraft: (v: LogisticsDraft) => void
  },
) {
  setters.setConv(d1.convention)
  setters.setOrganizationSummary(d1.organizationSummary ?? null)
  setters.setIsPinned(Boolean(d1.isPinned))
  setters.setAnchorEventSummary(d1.anchorEventSummary ?? null)
  setters.setContributorsPreview(Array.isArray(d1.contributorsPreview) ? d1.contributorsPreview : [])
  setters.setLogisticsDraft(logisticsDraftFromSettings(d1.convention.settings as ConventionSettings | undefined))
}

type UseConventionHubOptions = {
  slug: string | undefined
  previewRoleQuery?: string | null
}

export function useConventionHub({ slug, previewRoleQuery }: UseConventionHubOptions) {
  const key = encodeURIComponent(slug ?? '')

  const [conv, setConv] = useState<ConvRow | null>(null)
  const [organizationSummary, setOrganizationSummary] = useState<HostedByOrg | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const [anchorEventSummary, setAnchorEventSummary] = useState<{
    id: string
    title: string
    imageUrl: string | null
    locationLabel?: string | null
  } | null>(null)
  const [slots, setSlots] = useState<ScheduleSlot[] | null>(null)
  const [docs, setDocs] = useState<ConventionHubDoc[]>([])
  const [pages, setPages] = useState<ConventionHubPage[]>([])
  const [access, setAccess] = useState<ConventionAccess | null>(null)
  const [contributorsPreview, setContributorsPreview] = useState<ContributorPreview[]>([])
  const [logisticsDraft, setLogisticsDraft] = useState<LogisticsDraft>(logisticsDraftFromSettings(undefined))
  const [scheduleRevision, setScheduleRevision] = useState<string | null>(null)
  const [myScheduleItems, setMyScheduleItems] = useState<MyScheduleItem[]>([])
  const [hubChannelsMode, setHubChannelsMode] = useState(false)
  const [channelIds, setChannelIds] = useState<ConventionHubChannel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [convLoadAttempted, setConvLoadAttempted] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const payloadSetters = useMemo(
    () => ({
      setConv,
      setOrganizationSummary,
      setIsPinned,
      setAnchorEventSummary,
      setContributorsPreview,
      setLogisticsDraft,
    }),
    [],
  )

  const reloadProgramSlices = useCallback(async () => {
    if (!slug) return
    const k = encodeURIComponent(slug)
    try {
      const [r1, r2, r4, r5] = await Promise.all([
        fetch(`/api/v1/conventions/${k}`, { credentials: 'include' }),
        fetch(`/api/v1/conventions/${k}/slots`, { credentials: 'include' }),
        fetch(`/api/v1/conventions/${k}/documents`, { credentials: 'include' }),
        fetch(`/api/v1/conventions/${k}/custom-pages`, { credentials: 'include' }),
      ])
      if (r1.ok) {
        applyConventionPayload(
          (await r1.json()) as Parameters<typeof applyConventionPayload>[0],
          payloadSetters,
        )
      }
      if (r2.ok) {
        const d2 = (await r2.json()) as { items: ScheduleSlot[]; scheduleRevision?: string }
        setSlots(d2.items)
        if (d2.scheduleRevision) setScheduleRevision(d2.scheduleRevision)
      }
      if (r4.ok) {
        const d4 = (await r4.json()) as { items: ConventionHubDoc[] }
        setDocs(d4.items)
      }
      if (r5.ok) {
        const d5 = (await r5.json()) as { items: ConventionHubPage[] }
        setPages(d5.items)
      }
    } catch {
      /* ignore */
    }
  }, [slug, payloadSetters])

  const reloadSlotsOnly = useCallback(async () => {
    if (!slug) return
    const k = encodeURIComponent(slug)
    const r = await fetch(`/api/v1/conventions/${k}/slots`, { credentials: 'include' })
    if (!r.ok) return
    const d = (await r.json()) as { items: ScheduleSlot[]; scheduleRevision?: string }
    setSlots(d.items)
    if (d.scheduleRevision) setScheduleRevision(d.scheduleRevision)
  }, [slug])

  const reloadMySchedule = useCallback(async () => {
    if (!slug) return
    const k = encodeURIComponent(slug)
    const r = await fetch(`/api/v1/conventions/${k}/my-schedule`, { credentials: 'include' })
    if (!r.ok) {
      setMyScheduleItems([])
      return
    }
    const d = (await r.json()) as { items: MyScheduleItem[] }
    setMyScheduleItems(d.items ?? [])
  }, [slug])

  const retryLoad = useCallback(() => {
    setErr(null)
    setReloadToken((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    void (async () => {
      setErr(null)
      try {
        const rawPreview = previewRoleQuery?.trim().toLowerCase() ?? ''
        const previewQs = rawPreview ? `?previewRole=${encodeURIComponent(rawPreview)}` : ''
        const [r1, r2, r3, r4, r5] = await Promise.all([
          fetch(`/api/v1/conventions/${key}`, { credentials: 'include' }),
          fetch(`/api/v1/conventions/${key}/slots`, { credentials: 'include' }),
          fetch(`/api/v1/conventions/${key}/access${previewQs}`, { credentials: 'include' }),
          fetch(`/api/v1/conventions/${key}/documents`, { credentials: 'include' }),
          fetch(`/api/v1/conventions/${key}/custom-pages`, { credentials: 'include' }),
        ])
        if (cancelled) return
        if (!r1.ok) {
          const errJson = (await r1.json().catch(() => ({}))) as { error?: string }
          const apiMsg = typeof errJson.error === 'string' ? errJson.error : ''
          if (r1.status === 503) {
            setErr(
              apiMsg || 'Could not load convention data right now. Try again in a moment.',
            )
          } else if (r1.status === 404) {
            setErr(
              `No convention matches this URL slug (${slug ?? ''}). Check the link or browse events and conventions.`,
            )
          } else {
            setErr(apiMsg || `Could not load convention (HTTP ${r1.status}).`)
          }
          return
        }
        const d1 = (await r1.json()) as Parameters<typeof applyConventionPayload>[0]
        applyConventionPayload(d1, payloadSetters)
        if (r2.ok) {
          const d2 = (await r2.json()) as { items: ScheduleSlot[]; scheduleRevision?: string }
          setSlots(d2.items)
          if (d2.scheduleRevision) setScheduleRevision(d2.scheduleRevision)
        } else {
          setSlots([])
        }
        if (r3.ok) setAccess((await r3.json()) as ConventionAccess)
        if (r4.ok) {
          const d4 = (await r4.json()) as { items: ConventionHubDoc[] }
          setDocs(d4.items)
        }
        if (r5.ok) {
          const d5 = (await r5.json()) as { items: ConventionHubPage[] }
          setPages(d5.items)
        }
        let hubChannelItems: ConventionHubChannel[] = []
        const hubCr = await fetch(`/api/v1/conventions/${encodeURIComponent(key)}/hub-channels`, {
          credentials: 'include',
        })
        if (hubCr.ok) {
          const hubCd = (await hubCr.json()) as { items: ConventionHubChannel[] }
          hubChannelItems = hubCd.items ?? []
        }
        if (hubChannelItems.length > 0) {
          setHubChannelsMode(true)
          setChannelIds(hubChannelItems)
          const first = hubChannelItems.find((c) => c.kind === 'ANNOUNCEMENTS') ?? hubChannelItems[0] ?? null
          if (first) setSelectedChannelId(first.id)
        } else if (d1.convention.organizationId) {
          const cr = await fetch(
            `/api/v1/organizations/${encodeURIComponent(d1.convention.organizationId)}/channels?forConventionId=${encodeURIComponent(d1.convention.id)}`,
            { credentials: 'include' },
          )
          if (cr.ok) {
            const cd = (await cr.json()) as { items: ConventionHubChannel[] }
            setHubChannelsMode(false)
            setChannelIds(cd.items)
            const first = cd.items.find((c) => c.kind === 'ANNOUNCEMENTS') ?? cd.items[0] ?? null
            if (first) setSelectedChannelId(first.id)
          }
        }
      } catch {
        if (!cancelled) setErr('Network error')
      } finally {
        if (!cancelled) setConvLoadAttempted(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, key, reloadToken, previewRoleQuery, payloadSetters])

  const slotsByDay = useMemo(() => {
    if (!slots?.length) return [] as { day: string; items: ScheduleSlot[] }[]
    const sorted = sortSlotsForAgenda(slots)
    const map = new Map<string, ScheduleSlot[]>()
    for (const s of sorted) {
      const label = dayHeading(s.startsAt, conv?.timezone)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(s)
    }
    return Array.from(map.entries()).map(([day, items]) => ({ day, items }))
  }, [slots, conv?.timezone])

  const eventSystems = (conv?.settings as ConventionSettings | undefined)?.eventSystems ?? null
  const themeConfig = useMemo(() => parseThemeConfig(eventSystems?.themeConfig ?? null), [eventSystems?.themeConfig])
  const themeVars = useMemo(() => themeConfigToCssVars(themeConfig), [themeConfig])
  const themeAccent = themeConfig.accent ?? null

  const attendeeGuide = useMemo(
    (): PublicAttendeeGuide => publicAttendeeGuideJson(parseAttendeeGuideJson(eventSystems?.attendeeGuideJson ?? null)),
    [eventSystems?.attendeeGuideJson],
  )
  const hasAttendeeGuide = useMemo(() => publicAttendeeGuideHasContent(attendeeGuide), [attendeeGuide])

  const attendeeOk = Boolean(access?.canView)
  const listingClosed = Boolean(conv?.settings && conv.settings.publicProgramListing === false)
  const scheduleOpen = !listingClosed || attendeeOk

  return {
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
    setDocs,
    pages,
    setPages,
    access,
    contributorsPreview,
    logisticsDraft,
    setLogisticsDraft,
    scheduleRevision,
    setScheduleRevision,
    myScheduleItems,
    hubChannelsMode,
    channelIds,
    setChannelIds,
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
    themeConfig,
    themeVars,
    themeAccent,
    attendeeGuide,
    hasAttendeeGuide,
    attendeeOk,
    scheduleOpen,
    settings: conv?.settings as ConventionSettings | undefined,
  }
}
