import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { RSVP_LABEL_INTERESTED } from '@c2k/shared'
import EventCoverPhotoControl from '@/components/events/EventCoverPhotoControl'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import EventContributorsPanel from '@/components/organizer/EventContributorsPanel'
import EventMatchmakerSettingsSection from '@/components/organizer/EventMatchmakerSettingsSection'
import type { ApiEventListItem } from '@/lib/api-event-mapper'
import { useAuth } from '@/contexts/AuthContext'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  venuePlaceId: string
  venuePlaceLabel: string
}

type VenuePlaceOption = {
  id: string
  slug: string
  name: string
  city: string | null
  region: string | null
}

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

type Props = {
  eventId: string
  /** Org slug from route; optional when opened from group organizer. */
  orgSlug?: string
  groupId?: string
}

export default function EventOrganizerPanel({ eventId, orgSlug = '', groupId }: Props) {
  const { isAuthenticated, viewerUsername } = useAuth()
  const [apiEvent, setApiEvent] = useState<ApiEventListItem | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'invalid'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hostEditDraft, setHostEditDraft] = useState<HostEditDraft | null>(null)
  const [hostEditMsg, setHostEditMsg] = useState<string | null>(null)
  const [hostEditBusy, setHostEditBusy] = useState(false)
  const [attendeesPayload, setAttendeesPayload] = useState<AttendeesPayload | null>(null)
  const [rsvpQueue, setRsvpQueue] = useState<RsvpQueueRow[]>([])
  const [rsvpQueueBusy, setRsvpQueueBusy] = useState(false)
  const [featuredBusy, setFeaturedBusy] = useState(false)
  const [featuredMsg, setFeaturedMsg] = useState<string | null>(null)
  const [rsvpOpenBusy, setRsvpOpenBusy] = useState(false)
  const [rsvpOpenMsg, setRsvpOpenMsg] = useState<string | null>(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverMsg, setCoverMsg] = useState<string | null>(null)
  const [venueOptions, setVenueOptions] = useState<VenuePlaceOption[]>([])
  const [venueSearch, setVenueSearch] = useState('')

  const isUuid = UUID_RE.test(eventId)
  const isVirtual = apiEvent?.eventFormat === 'virtual'
  const hostUsername = apiEvent?.hostUsername ?? null
  const viewerIsHost = Boolean(
    isAuthenticated && hostUsername && viewerUsername && hostUsername === viewerUsername,
  )
  const viewerCanManage = Boolean(apiEvent?.viewerCanManage)
  const canEdit = viewerIsHost || viewerCanManage

  const loadEvent = useCallback(async () => {
    if (!isUuid) {
      setLoadState('invalid')
      return
    }
    setLoadState('loading')
    setLoadError(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}`, { credentials: 'include' })
      if (!r.ok) {
        setLoadState('error')
        setLoadError(r.status === 404 ? 'Event not found.' : 'Could not load event.')
        return
      }
      const data = (await r.json()) as { event: ApiEventListItem }
      setApiEvent(data.event ?? null)
      setLoadState(data.event ? 'ready' : 'error')
    } catch {
      setLoadState('error')
      setLoadError('Network error loading event.')
    }
  }, [eventId, isUuid])

  useEffect(() => {
    void loadEvent()
  }, [loadEvent])

  useEffect(() => {
    if (!apiEvent || !canEdit) {
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
      venuePlaceId: apiEvent.venuePlaceId ?? '',
      venuePlaceLabel: apiEvent.venuePlaceName ?? '',
    })
  }, [apiEvent, canEdit])

  useEffect(() => {
    if (!canEdit || isVirtual) return
    const q = venueSearch.trim()
    if (q.length < 2) {
      setVenueOptions([])
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const p = new URLSearchParams({ q, category: 'dungeon_club', limit: '12' })
          const r = await fetch(`/api/v1/community-places?${p.toString()}`, { credentials: 'include' })
          if (!r.ok || cancelled) return
          const data = (await r.json()) as { items?: VenuePlaceOption[] }
          if (!cancelled) setVenueOptions(data.items ?? [])
        } catch {
          if (!cancelled) setVenueOptions([])
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [canEdit, isVirtual, venueSearch])

  useEffect(() => {
    if (!isUuid || loadState !== 'ready') return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/attendees`, {
          credentials: 'include',
        })
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
  }, [eventId, isUuid, loadState])

  useEffect(() => {
    if (!isUuid || loadState !== 'ready' || !apiEvent || !canEdit) {
      setRsvpQueue([])
      return
    }
    if (!(apiEvent.pendingRsvpApprovals && apiEvent.pendingRsvpApprovals > 0)) {
      setRsvpQueue([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/rsvps`, { credentials: 'include' })
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
  }, [eventId, isUuid, loadState, apiEvent, canEdit])

  async function patchRsvpOpen(nextOpen: boolean) {
    setRsvpOpenBusy(true)
    setRsvpOpenMsg(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsvpOpen: nextOpen }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setRsvpOpenMsg(j.error ?? 'Could not update RSVP status')
        return
      }
      setRsvpOpenMsg(nextOpen ? 'RSVPs reopened.' : 'RSVPs closed.')
      await loadEvent()
    } catch {
      setRsvpOpenMsg('Network error')
    } finally {
      setRsvpOpenBusy(false)
    }
  }

  async function patchFeatured(nextFeatured: boolean, nextUntil: string | null) {
    setFeaturedBusy(true)
    setFeaturedMsg(null)
    try {
      const body: Record<string, unknown> = { featured: nextFeatured }
      body.featuredUntil = nextUntil ? new Date(nextUntil).toISOString() : null
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setFeaturedMsg(j.error ?? 'Could not update featured status')
        return
      }
      setFeaturedMsg(nextFeatured ? 'Event marked featured.' : 'Featured badge removed.')
      await loadEvent()
    } catch {
      setFeaturedMsg('Network error')
    } finally {
      setFeaturedBusy(false)
    }
  }

  async function patchEventCover(imageUrl: string | null) {
    if (!isUuid) return
    setCoverBusy(true)
    setCoverMsg(null)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; event?: ApiEventListItem }
      if (!r.ok) {
        setCoverMsg(j.error ?? 'Could not update cover photo')
        return
      }
      if (j.event) setApiEvent(j.event)
      setCoverMsg(imageUrl ? 'Cover photo updated.' : 'Cover photo removed.')
    } catch {
      setCoverMsg('Network error')
    } finally {
      setCoverBusy(false)
    }
  }

  async function submitHostEdit(ev: FormEvent) {
    ev.preventDefault()
    if (!hostEditDraft || !isUuid) return
    setHostEditBusy(true)
    setHostEditMsg(null)
    try {
      const capRaw = hostEditDraft.capacityMax.trim()
      let capacityMax: number | null = null
      if (capRaw) {
        const n = parseInt(capRaw, 10)
        if (!Number.isNaN(n) && n > 0) capacityMax = n
      }
      const body: Record<string, unknown> = {
        title: hostEditDraft.title.trim(),
        description: hostEditDraft.description.trim() || null,
        dressCode: hostEditDraft.dressCode.trim() || null,
        expectedCostText: hostEditDraft.expectedCostText.trim() || null,
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
        body.venuePlaceId = hostEditDraft.venuePlaceId.trim() || null
      } else {
        body.location = hostEditDraft.location.trim() || null
      }
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; event?: ApiEventListItem }
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

  async function patchRsvpApproval(userId: string, decision: 'approve' | 'reject') {
    setRsvpQueueBusy(true)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/rsvp-approval`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, decision }),
      })
      if (r.ok) {
        setRsvpQueue((q) => q.filter((row) => row.userId !== userId))
        void loadEvent()
      }
    } finally {
      setRsvpQueueBusy(false)
    }
  }

  if (!isUuid) {
    return (
      <OrganizerPanel title="Event manager" description="Use a published event UUID from the API.">
        <p className="text-sm text-dc-text-muted">
          Demo event ids are not supported here. Open the{' '}
          <Link to={`/events/${encodeURIComponent(eventId)}`} className="text-dc-accent hover:underline">
            public event page
          </Link>{' '}
          instead.
        </p>
      </OrganizerPanel>
    )
  }

  if (loadState === 'loading') {
    return <div className="h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" aria-busy="true" />
  }

  if (loadState === 'error' || !apiEvent) {
    return (
      <OrganizerPanel title="Event manager" description={loadError ?? 'Could not load event.'}>
        <button
          type="button"
          onClick={() => void loadEvent()}
          className="text-sm text-dc-accent hover:underline"
        >
          Retry
        </button>
      </OrganizerPanel>
    )
  }

  const programOrgSlug = apiEvent.organizationSlug ?? orgSlug
  const programHref =
    apiEvent.hasProgram && apiEvent.conventionSlug && programOrgSlug ?
      `/organizer/orgs/${encodeURIComponent(programOrgSlug)}/conventions/${encodeURIComponent(apiEvent.conventionSlug)}?tab=program`
    : null

  return (
    <div className="space-y-5 max-w-3xl">
      {programHref ?
        <OrganizerPanel
          title="Program"
          description="This event has a full convention program. Manage slots in Event Systems."
        >
          <Link
            to={programHref}
            className="inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-3 text-sm font-medium text-dc-text hover:bg-dc-accent-hover"
          >
            Manage program →
          </Link>
        </OrganizerPanel>
      : null}

      <EventMatchmakerSettingsSection eventId={eventId} canEdit={canEdit} />

      {!canEdit ?
        <OrganizerPanel
          title="Organizer access"
          description="Only the event host or org moderators can edit settings and approve RSVPs from this console."
        >
          <p className="text-sm text-dc-text-muted">
            Host: @{hostUsername ?? 'unknown'}.
            {groupId ?
              <>
                {' '}
                <Link
                  to={`/groups/${encodeURIComponent(groupId)}`}
                  className="text-dc-accent hover:underline"
                >
                  View group page
                </Link>
              </>
            : null}
          </p>
        </OrganizerPanel>
      : hostEditDraft ?
        <>
          <OrganizerPanel title="Organizer menu" description="Quick actions for this event.">
            <details className="group">
              <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-dc-border bg-dc-surface-muted px-3 text-sm font-medium text-dc-text hover:border-dc-accent-border/40 [&::-webkit-details-marker]:hidden">
                <span aria-hidden>⋯</span>
                <span>Actions</span>
              </summary>
              <div className="mt-3 space-y-2 rounded-lg border border-dc-border bg-dc-elevated-solid p-2">
                <button
                  type="button"
                  disabled={rsvpOpenBusy}
                  onClick={() => void patchRsvpOpen(apiEvent.rsvpOpen === false)}
                  className="flex w-full min-h-9 items-center rounded-lg px-3 text-left text-sm text-dc-text hover:bg-dc-surface-muted disabled:opacity-50"
                >
                  {apiEvent.rsvpOpen === false ? 'Reopen RSVPs' : 'Close RSVPs'}
                </button>
                <p className="px-3 text-xs text-dc-muted">
                  {apiEvent.rsvpOpen === false ?
                    'Attendees cannot join or change RSVP until you reopen.'
                  : `RSVPs are open. Guests can RSVP Going or ${RSVP_LABEL_INTERESTED}.`}
                </p>
              </div>
            </details>
            {rsvpOpenMsg ?
              <p
                className={`mt-2 text-sm ${rsvpOpenMsg.includes('error') || rsvpOpenMsg.includes('Could not') ? 'text-amber-200' : 'text-emerald-300'}`}
                role="status"
              >
                {rsvpOpenMsg}
              </p>
            : null}
          </OrganizerPanel>
          <OrganizerPanel
            title="Cover photo"
            description="Marketing image for the event page, calendar cards, and discovery."
          >
            <EventCoverPhotoControl
              compact
              eventId={isUuid ? eventId : undefined}
              imageUrl={apiEvent.imageUrl ?? null}
              onChange={(url) => {
                if (url) {
                  setApiEvent((ev) => (ev ? { ...ev, imageUrl: url } : ev))
                  setCoverMsg('Cover photo updated.')
                } else {
                  void patchEventCover(null)
                }
              }}
              canUpload={isAuthenticated}
              disabled={coverBusy}
            />
            {apiEvent.hasProgram && programHref ?
              <p className="mt-3 text-dc-micro text-dc-text-muted">
                Convention programs can also set a hero in Event Systems branding. Both use the same
                calendar event cover.
              </p>
            : null}
            {coverMsg ?
              <p className="mt-2 text-sm text-dc-text-muted" role="status">
                {coverMsg}
              </p>
            : null}
          </OrganizerPanel>
          <OrganizerPanel
            title="Discovery spotlight"
            description="Show a green Featured badge on browse and discovery event cards."
          >
            <div className="space-y-3">
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-dc-text">
                <input
                  type="checkbox"
                  checked={!!apiEvent.featured}
                  disabled={featuredBusy}
                  onChange={(e) => {
                    const checked = e.target.checked
                    void patchFeatured(checked, checked ? (apiEvent.featuredUntil ?? null) : null)
                  }}
                  className="rounded border-dc-border-strong"
                />
                Featured on browse grids
              </label>
              {apiEvent.featured ?
                <div>
                  <label htmlFor="eo-featured-until" className="block text-xs text-dc-muted mb-1">
                    Featured until (optional)
                  </label>
                  <input
                    id="eo-featured-until"
                    type="datetime-local"
                    disabled={featuredBusy}
                    defaultValue={
                      apiEvent.featuredUntil ?
                        new Date(apiEvent.featuredUntil).toISOString().slice(0, 16)
                      : ''
                    }
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      void patchFeatured(true, v || null)
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
                  />
                  <p className="mt-1 text-xs text-dc-muted">Leave blank to stay featured until you turn it off.</p>
                </div>
              : null}
              {featuredMsg ?
                <p
                  className={`text-sm ${featuredMsg.includes('error') || featuredMsg.includes('Could not') ? 'text-amber-200' : 'text-emerald-300'}`}
                  role="status"
                >
                  {featuredMsg}
                </p>
              : null}
            </div>
          </OrganizerPanel>
          <OrganizerPanel title="Event settings" description="Host edits sync to the public event page.">
          <form onSubmit={submitHostEdit} className="space-y-4">
            <div>
              <label htmlFor="eo-title" className="block text-xs text-dc-muted mb-1">
                Title
              </label>
              <input
                id="eo-title"
                value={hostEditDraft.title}
                onChange={(e) => setHostEditDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
              />
            </div>
            <div>
              <label htmlFor="eo-desc" className="block text-xs text-dc-muted mb-1">
                Description
              </label>
              <textarea
                id="eo-desc"
                rows={3}
                value={hostEditDraft.description}
                onChange={(e) => setHostEditDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
              />
            </div>
            {!isVirtual ?
              <>
                <div>
                  <label htmlFor="eo-locpub" className="block text-xs text-dc-muted mb-1">
                    Public area (city, neighborhood, venue name)
                  </label>
                  <input
                    id="eo-locpub"
                    value={hostEditDraft.publicLocationSummary}
                    onChange={(e) =>
                      setHostEditDraft((d) => (d ? { ...d, publicLocationSummary: e.target.value } : d))
                    }
                    placeholder="e.g. Downtown Harrisburg. Café TBD"
                    className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
                  />
                  <p className="mt-1 text-xs text-dc-muted">
                    Shown on the public page when the full address is hidden.
                  </p>
                </div>
                <div>
                  <label htmlFor="eo-venue-search" className="block text-xs text-dc-muted mb-1">
                    Venue on Kinky Map (optional)
                  </label>
                  {hostEditDraft.venuePlaceId ?
                    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-dc-border bg-dc-surface/40 px-3 py-2 text-sm">
                      <span className="text-dc-text">
                        {hostEditDraft.venuePlaceLabel || 'Linked venue'}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-dc-accent hover:underline"
                        onClick={() =>
                          setHostEditDraft((d) =>
                            d ? { ...d, venuePlaceId: '', venuePlaceLabel: '' } : d,
                          )
                        }
                      >
                        Clear
                      </button>
                    </div>
                  : null}
                  <input
                    id="eo-venue-search"
                    value={venueSearch}
                    onChange={(e) => setVenueSearch(e.target.value)}
                    placeholder="Search dungeons & clubs…"
                    className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
                  />
                  {venueOptions.length > 0 ?
                    <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-dc-border bg-dc-elevated-solid">
                      {venueOptions.map((v) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-dc-surface/60"
                            onClick={() => {
                              setHostEditDraft((d) =>
                                d ?
                                  {
                                    ...d,
                                    venuePlaceId: v.id,
                                    venuePlaceLabel: [v.name, v.city, v.region].filter(Boolean).join(' · '),
                                  }
                                : d,
                              )
                              setVenueSearch('')
                              setVenueOptions([])
                            }}
                          >
                            {v.name}
                            {(v.city || v.region) ?
                              <span className="text-dc-muted"> · {[v.city, v.region].filter(Boolean).join(', ')}</span>
                            : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  : null}
                  <p className="mt-1 text-xs text-dc-muted">
                    Links this event to a permanent venue for map discovery and venue event lists.
                  </p>
                </div>
                <div>
                  <label htmlFor="eo-loc" className="block text-xs text-dc-muted mb-1">
                    Full address or meeting link
                  </label>
                  <input
                    id="eo-loc"
                    value={hostEditDraft.location}
                    onChange={(e) => setHostEditDraft((d) => (d ? { ...d, location: e.target.value } : d))}
                    placeholder="Street address, venue room, or virtual URL"
                    className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="eo-locvis" className="block text-xs text-dc-muted mb-1">
                    Location visibility
                  </label>
                  <select
                    id="eo-locvis"
                    value={hostEditDraft.locationVisibility}
                    onChange={(e) =>
                      setHostEditDraft((d) =>
                        d ?
                          {
                            ...d,
                            locationVisibility: e.target.value as HostEditDraft['locationVisibility'],
                          }
                        : d,
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
                  >
                    <option value="public">Public</option>
                    <option value="rsvp">After RSVP</option>
                    <option value="approved">After host approval</option>
                  </select>
                  <p className="mt-1 text-xs text-dc-muted">
                    Munches often use “After RSVP” so only the public area shows until someone joins.
                  </p>
                </div>
                <div>
                  <label htmlFor="eo-cap" className="block text-xs text-dc-muted mb-1">
                    Capacity max
                  </label>
                  <input
                    id="eo-cap"
                    value={hostEditDraft.capacityMax}
                    onChange={(e) => setHostEditDraft((d) => (d ? { ...d, capacityMax: e.target.value } : d))}
                    className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-dc-text-muted">
                  <input
                    type="checkbox"
                    checked={hostEditDraft.newcomerFriendly}
                    onChange={(e) =>
                      setHostEditDraft((d) => (d ? { ...d, newcomerFriendly: e.target.checked } : d))
                    }
                  />
                  Newcomer-friendly
                </label>
              </>
            : null}
            <div>
              <label htmlFor="eo-dress" className="block text-xs text-dc-muted mb-1">
                Dress code
              </label>
              <input
                id="eo-dress"
                value={hostEditDraft.dressCode}
                onChange={(e) => setHostEditDraft((d) => (d ? { ...d, dressCode: e.target.value } : d))}
                className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
              />
            </div>
            {hostEditMsg ?
              <p
                className={`text-sm ${hostEditMsg === 'Saved.' ? 'text-emerald-300' : 'text-amber-200'}`}
                role="status"
              >
                {hostEditMsg}
              </p>
            : null}
            <button
              type="submit"
              disabled={hostEditBusy}
              className="min-h-9 rounded-lg bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
            >
              {hostEditBusy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </OrganizerPanel>
        </>
      : null}

      <EventContributorsPanel eventId={eventId} canEdit={canEdit} />

      <OrganizerPanel title="Attendees" description="RSVP list for this event.">
        {attendeesPayload ?
          <div className="space-y-3 text-sm">
            <p className="text-dc-muted">
              Going {attendeesPayload.goingCount}
              {attendeesPayload.maybeCount > 0 ? ` · ${RSVP_LABEL_INTERESTED} ${attendeesPayload.maybeCount}` : ''}
              {attendeesPayload.waitlistCount > 0 ? ` · Waitlist ${attendeesPayload.waitlistCount}` : ''}
            </p>
            <ul className="divide-y divide-white/10 rounded-lg border border-dc-border">
              {attendeesPayload.items.map((a) => (
                <li key={a.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-dc-text">
                    {a.displayName ?? a.username}
                    <span className="text-dc-muted ml-1">@{a.username}</span>
                  </span>
                  <Link
                    to={`/profile/${encodeURIComponent(a.username)}`}
                    className="text-xs text-dc-accent hover:underline shrink-0"
                  >
                    Profile
                  </Link>
                </li>
              ))}
            </ul>
            {attendeesPayload.items.length === 0 ?
              <p className="text-dc-muted">No attendees yet.</p>
            : null}
          </div>
        : (
          <p className="text-sm text-dc-muted">Loading attendees…</p>
        )}
      </OrganizerPanel>

      {canEdit && rsvpQueue.length > 0 ?
        <OrganizerPanel title="RSVP approvals" description="Pending screening or approval queue.">
          <ul className="space-y-2">
            {rsvpQueue.map((row) => (
              <li
                key={row.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dc-border px-3 py-2 text-sm"
              >
                <div>
                  <span className="text-dc-text">{row.displayName ?? row.username}</span>
                  {row.screeningAnswer ?
                    <p className="text-xs text-dc-muted mt-1">{row.screeningAnswer}</p>
                  : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={rsvpQueueBusy}
                    onClick={() => void patchRsvpApproval(row.userId, 'approve')}
                    className="min-h-8 rounded-lg bg-emerald-600/80 px-2.5 text-xs text-dc-text"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={rsvpQueueBusy}
                    onClick={() => void patchRsvpApproval(row.userId, 'reject')}
                    className="min-h-8 rounded-lg border border-dc-border px-2.5 text-xs text-dc-text-muted"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </OrganizerPanel>
      : null}
    </div>
  )
}
