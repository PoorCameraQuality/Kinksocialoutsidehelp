import { RSVP_LABEL_INTERESTED } from '@c2k/shared'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Dialog from '@/components/ui/Dialog'
import FormField from '@/components/ui/FormField'
import TextInput from '@/components/ui/TextInput'
import EventCoverPhotoControl from '@/components/events/EventCoverPhotoControl'
import { attachEventCover } from '@/lib/event-cover-upload'
import {
  CreateFlowStepper,
  FormatToggle,
  PreviewRow,
  PreviewSummary,
  SectionCard,
  StickyWizardFooter,
  WizardCheckbox,
  fieldDatetimeClass,
  fieldSelectClass,
  fieldTextareaClass,
} from '@/components/create-flow/CreateFlowWizardUi'
import {
  CREATE_FLOW_OPEN_EVENT,
  readCreateFlowDataset,
  type OpenCreateFlowOptions,
} from '@/lib/open-create-flow'

function formatLocalDatetime(isoOrLocal: string): string {
  if (!isoOrLocal.trim()) return '-'
  const d = new Date(isoOrLocal)
  if (Number.isNaN(d.getTime())) return isoOrLocal
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const LOCATION_VISIBILITY_LABELS: Record<'public' | 'rsvp' | 'approved', string> = {
  public: 'Public. Everyone sees the address',
  rsvp: `After RSVP. Address for Going/${RSVP_LABEL_INTERESTED} only`,
  approved: 'After host approval',
}

type CreateEventDraft = {
  title: string
  location: string
  startsAt: string
  endsAt: string
  dressCode: string
  expectedCostText: string
  description: string
  publicLocationSummary: string
  screeningQuestion: string
  accessibilityNotes: string
  capacityMax: string
  virtualAgenda: string
  materialsUrl: string
  eventTimezone: string
  imageUrl: string
  coverQuarantineKey: string
}

const EMPTY_CREATE_EVENT_DRAFT: CreateEventDraft = {
  title: '',
  location: '',
  startsAt: '',
  endsAt: '',
  dressCode: '',
  expectedCostText: '',
  description: '',
  publicLocationSummary: '',
  screeningQuestion: '',
  accessibilityNotes: '',
  capacityMax: '',
  virtualAgenda: '',
  materialsUrl: '',
  eventTimezone: '',
  imageUrl: '',
  coverQuarantineKey: '',
}

export default function CreateFlowModal() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const skipPathCloseRef = useRef(true)
  const [isOpen, setIsOpen] = useState(false)
  const [eventStep, setEventStep] = useState(1)
  const [eventPublishError, setEventPublishError] = useState<string | null>(null)
  const [eventPublishing, setEventPublishing] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [draft, setDraft] = useState<CreateEventDraft>(EMPTY_CREATE_EVENT_DRAFT)
  const [publishOrgs, setPublishOrgs] = useState<
    { id: string; slug: string; displayName: string; canCreateConventionShell?: boolean }[]
  >([])
  const [publishOrgId, setPublishOrgId] = useState<string>('')
  const [fullProgram, setFullProgram] = useState(false)
  const [eventFormat, setEventFormat] = useState<'in-person' | 'virtual'>('in-person')
  const [locationVisibility, setLocationVisibility] = useState<'public' | 'rsvp' | 'approved'>('public')
  const [attendeeListVisibility, setAttendeeListVisibility] = useState<'public' | 'count_only'>('public')
  const [newcomerFriendly, setNewcomerFriendly] = useState(false)
  const [eventCategory, setEventCategory] = useState('')
  const [prefillGroupId, setPrefillGroupId] = useState('')
  const [virtualSessionStyle, setVirtualSessionStyle] = useState<'social' | 'education' | 'mixed'>('social')
  const [recordingPolicy, setRecordingPolicy] = useState<
    'not_recorded' | 'live_only' | 'shared_with_registrants' | 'tbd' | ''
  >('')

  const updateDraft = useCallback((patch: Partial<CreateEventDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
  }, [])

  const isConventionCreate = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('create') === 'convention'
  }, [location.search])

  const resetCreateFormState = useCallback(() => {
    setEventStep(1)
    setEventPublishError(null)
    setStepError(null)
    setEventPublishing(false)
    setPublishOrgId('')
    setFullProgram(false)
    setPublishOrgs([])
    setEventFormat('in-person')
    setVirtualSessionStyle('social')
    setRecordingPolicy('')
    setLocationVisibility('public')
    setAttendeeListVisibility('public')
    setNewcomerFriendly(false)
    setEventCategory('')
    setPrefillGroupId('')
    setDraft(EMPTY_CREATE_EVENT_DRAFT)
  }, [])

  const applyOpenCreateFlow = useCallback(
    (options: OpenCreateFlowOptions) => {
      resetCreateFormState()
      setEventStep(1)
      setStepError(null)
      setIsOpen(true)
      if (options.type === 'convention') setFullProgram(true)
      if (options.kind === 'munch') setEventCategory('Munch')
      if (options.prefillGroupId) setPrefillGroupId(options.prefillGroupId)
      if (options.prefillOrgId) setPublishOrgId(options.prefillOrgId)
    },
    [resetCreateFormState],
  )

  const stripCreateFlowSearchParams = useCallback(() => {
    const params = new URLSearchParams(location.search)
    const c = params.get('create')
    if (c !== 'event' && c !== 'convention') return
    params.delete('create')
    params.delete('prefillOrgId')
    params.delete('prefillGroupId')
    params.delete('kind')
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true })
  }, [location.pathname, location.search, navigate])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    resetCreateFormState()
    stripCreateFlowSearchParams()
    queueMicrotask(() => {
      previousFocusRef.current?.focus?.()
      previousFocusRef.current = null
    })
  }, [resetCreateFormState, stripCreateFlowSearchParams])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const trigger = target.closest('[data-create-trigger]') as HTMLElement | null
      if (!trigger) return
      e.preventDefault()
      previousFocusRef.current = document.activeElement as HTMLElement
      applyOpenCreateFlow(readCreateFlowDataset(trigger))
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [applyOpenCreateFlow])

  useEffect(() => {
    const handler = (e: Event) => {
      applyOpenCreateFlow((e as CustomEvent<OpenCreateFlowOptions>).detail)
    }
    window.addEventListener(CREATE_FLOW_OPEN_EVENT, handler)
    return () => window.removeEventListener(CREATE_FLOW_OPEN_EVENT, handler)
  }, [applyOpenCreateFlow])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const c = params.get('create')
    if (c !== 'event' && c !== 'convention') return
    applyOpenCreateFlow({
      type: c === 'convention' ? 'convention' : 'event',
      kind: params.get('kind') === 'munch' ? 'munch' : undefined,
      prefillGroupId:
        (() => {
          const gid = params.get('prefillGroupId')
          return gid && /^[0-9a-f-]{36}$/i.test(gid) ? gid : undefined
        })(),
      prefillOrgId:
        (() => {
          const oid = params.get('prefillOrgId')
          return oid && /^[0-9a-f-]{36}$/i.test(oid) ? oid : undefined
        })(),
    })
  }, [location.search, applyOpenCreateFlow])

  useEffect(() => {
    if (!isOpen) return
    const params = new URLSearchParams(location.search)
    const gid = params.get('prefillGroupId')
    if (!gid || !/^[0-9a-f-]{36}$/i.test(gid)) return
    const oidFromUrl = params.get('prefillOrgId')
    if (oidFromUrl) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/groups/${encodeURIComponent(gid)}`, { credentials: 'include' })
        if (!r.ok || cancelled) return
        const data = (await r.json()) as { group?: { organizationId?: string | null } }
        const orgId = data.group?.organizationId
        if (orgId && !cancelled) setPublishOrgId(orgId)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, location.search])

  const isMunchCategory = eventCategory === 'Munch'

  useEffect(() => {
    if (!isMunchCategory) return
    setFullProgram(false)
    setNewcomerFriendly(true)
    setLocationVisibility('rsvp')
  }, [isMunchCategory])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const c = params.get('create')
    if (c === 'event' || c === 'convention') return
    if (skipPathCloseRef.current) {
      skipPathCloseRef.current = false
      return
    }
    setIsOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const list = Array.from(focusables).filter((el) => !el.hasAttribute('disabled'))
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const t = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    }, 0)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(t)
    }
  }, [isOpen, eventStep])

  useEffect(() => {
    if (!isOpen || eventStep !== 3 || !isAuthenticated) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/v1/organizations/me/event-publish', { credentials: 'include' })
        if (!r.ok || cancelled) return
        const d = (await r.json()) as {
          items: { id: string; slug: string; displayName: string; canCreateConventionShell?: boolean }[]
        }
        if (cancelled) return
        const items = d.items ?? []
        setPublishOrgs(items)
        const params = new URLSearchParams(location.search)
        const oid = params.get('prefillOrgId')
        const prefill = oid ? items.find((o) => o.id === oid) : undefined
        if (prefill) {
          setPublishOrgId(oid!)
          if (params.get('create') === 'convention' && prefill.canCreateConventionShell) {
            setFullProgram(true)
          }
        }
      } catch {
        if (!cancelled) setPublishOrgs([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, eventStep, isAuthenticated, location.search])

  const readBasicsValidation = useCallback(() => {
    const title = draft.title.trim()
    const dtLocal = draft.startsAt
    if (!title || !dtLocal) {
      return 'Event title and start date & time are required.'
    }
    return null
  }, [draft.title, draft.startsAt])

  const publishEvent = useCallback(async () => {
    setEventPublishError(null)
    if (!isAuthenticated) {
      setEventPublishError('Log in to create an event.')
      return
    }
    const basicsErr = readBasicsValidation()
    if (basicsErr) {
      setEventPublishError(basicsErr)
      return
    }
    const title = draft.title.trim()
    const loc = draft.location.trim()
    const dtLocal = draft.startsAt
    const startsAt = new Date(dtLocal).toISOString()
    const endsLocal = draft.endsAt.trim()
    let endsAt = endsLocal ? new Date(endsLocal).toISOString() : undefined
    if (!endsAt && isMunchCategory && dtLocal) {
      endsAt = new Date(new Date(dtLocal).getTime() + 2 * 60 * 60 * 1000).toISOString()
    }
    const dressCode = draft.dressCode.trim()
    const expectedCostText = draft.expectedCostText.trim()
    setEventPublishing(true)
    try {
      const mat = draft.materialsUrl.trim()
      const tz = draft.eventTimezone.trim()
      const agenda = draft.virtualAgenda.trim()
      const eventCreatePayload: Record<string, unknown> = {
        title,
        location: loc || undefined,
        startsAt,
        endsAt,
        description: draft.description.trim() || undefined,
        dressCode: dressCode || undefined,
        expectedCostText: expectedCostText || undefined,
        organizationId: publishOrgId || undefined,
        groupId: prefillGroupId || undefined,
        eventFormat,
      }
      if (eventCategory.trim()) eventCreatePayload.category = eventCategory.trim()
      const coverQuarantine = draft.coverQuarantineKey.trim()
      const cover = draft.imageUrl.trim()
      if (cover && !coverQuarantine) eventCreatePayload.imageUrl = cover
      if (eventFormat === 'virtual') {
        eventCreatePayload.virtualSessionStyle = virtualSessionStyle
        if (agenda) eventCreatePayload.virtualAgenda = agenda
        if (mat) eventCreatePayload.materialsUrl = mat
        if (recordingPolicy) eventCreatePayload.recordingPolicy = recordingPolicy
        if (tz) eventCreatePayload.eventTimezone = tz
      }
      if (eventFormat === 'in-person') {
        eventCreatePayload.locationVisibility = locationVisibility
        const pub = draft.publicLocationSummary.trim()
        if (pub) eventCreatePayload.publicLocationSummary = pub
        const scr = draft.screeningQuestion.trim()
        if (scr) eventCreatePayload.screeningQuestion = scr
        if (newcomerFriendly) eventCreatePayload.newcomerFriendly = true
        const ax = draft.accessibilityNotes.trim()
        if (ax) eventCreatePayload.accessibilityNotes = ax
        const capRaw = draft.capacityMax.trim()
        if (capRaw) {
          const cap = parseInt(capRaw, 10)
          if (!Number.isNaN(cap) && cap > 0) eventCreatePayload.capacityMax = cap
        }
        eventCreatePayload.attendeeListVisibility = attendeeListVisibility
      }
      const r = await fetch('/api/v1/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventCreatePayload),
      })
      const resJson = (await r.json().catch(() => ({}))) as { error?: string; event?: { id: string } }
      if (!r.ok) {
        setEventPublishError(resJson.error ?? `Could not publish (${r.status})`)
        return
      }
      const eventId = resJson.event?.id
      if (!eventId) {
        setEventPublishError('Event was created but the response did not include an id. Check the API or try again.')
        return
      }
      if (coverQuarantine) {
        try {
          await attachEventCover(eventId, coverQuarantine)
        } catch (attachErr) {
          setEventPublishError(
            attachErr instanceof Error ?
              `Event created, but cover photo failed: ${attachErr.message}`
            : 'Event created, but cover photo could not be attached. Add it from organizer tools.',
          )
          navigate(`/events/${encodeURIComponent(eventId)}`, { replace: true })
          return
        }
      }
      const shellOrg = publishOrgs.find((o) => o.id === publishOrgId)
      if (fullProgram && publishOrgId) {
        if (!shellOrg?.canCreateConventionShell) {
          setEventPublishError(
            'Convention program shell requires org owner or admin role. Your calendar event was still created. Open it from Events to continue.',
          )
          navigate(`/events/${encodeURIComponent(eventId)}`, { replace: true })
          return
        }
        const slugBase =
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 80) || 'con'
        const slug = `${slugBase}-${eventId.slice(0, 8)}`
        const convStart = startsAt
        const convEnd = endsAt ?? new Date(new Date(startsAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
        const cr = await fetch('/api/v1/conventions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            name: title,
            description: draft.description.trim() || undefined,
            organizationId: publishOrgId,
            anchorEventId: eventId,
            startsAt: convStart,
            endsAt: convEnd,
          }),
        })
        const convRaw = (await cr.json().catch(() => ({}))) as { error?: string; convention?: { slug: string } }
        if (!cr.ok) {
          setEventPublishError(
            convRaw.error ??
              `Event was created but convention shell failed (org owner or admin required). Open /events/${eventId} to manage the calendar event.`,
          )
          navigate(`/events/${encodeURIComponent(eventId)}`, { replace: true })
          return
        }
        const convSlug = convRaw.convention?.slug ?? slug
        const orgSlug = publishOrgs.find((o) => o.id === publishOrgId)?.slug
        if (!orgSlug) {
          setEventPublishError('Convention was created but the organization could not be resolved.')
          return
        }
        setIsOpen(false)
        resetCreateFormState()
        navigate(
          `/organizer/orgs/${encodeURIComponent(orgSlug)}/conventions/${encodeURIComponent(convSlug)}`,
          { replace: true },
        )
        queueMicrotask(() => {
          previousFocusRef.current?.focus?.()
          previousFocusRef.current = null
        })
        return
      }
      setIsOpen(false)
      resetCreateFormState()
      navigate(`/events/${encodeURIComponent(eventId)}`, { replace: true })
      queueMicrotask(() => {
        previousFocusRef.current?.focus?.()
        previousFocusRef.current = null
      })
    } catch {
      setEventPublishError('Network error. Try again.')
    } finally {
      setEventPublishing(false)
    }
  }, [
    isAuthenticated,
    navigate,
    resetCreateFormState,
    fullProgram,
    publishOrgId,
    publishOrgs,
    eventFormat,
    virtualSessionStyle,
    recordingPolicy,
    locationVisibility,
    attendeeListVisibility,
    newcomerFriendly,
    eventCategory,
    prefillGroupId,
    isMunchCategory,
    readBasicsValidation,
    draft,
  ])

  const stepDescription = useMemo(() => {
    switch (eventStep) {
      case 1:
        return 'Start with the essentials. You can add more details in the next steps.'
      case 2:
        return 'Add a cover photo and description guests will see when browsing events.'
      case 3:
        return isConventionCreate ?
            'Publish to an organization calendar and optionally add a convention program shell.'
          : 'Choose where this event lives on the platform.'
      case 4:
        return 'Review the summary below, then publish when everything looks right.'
      default:
        return undefined
    }
  }, [eventStep, isConventionCreate])

  const goNext = useCallback(() => {
    setStepError(null)
    if (eventStep === 1) {
      const err = readBasicsValidation()
      if (err) {
        setStepError(err)
        return
      }
    }
    setEventStep((s) => Math.min(4, s + 1))
  }, [eventStep, readBasicsValidation])

  const buildPreview = () => {
    const title = draft.title.trim()
    const loc = draft.location.trim()
    const start = draft.startsAt
    const end = draft.endsAt.trim()
    const org = publishOrgs.find((o) => o.id === publishOrgId)
    return {
      title,
      titleMissing: !title,
      category: eventCategory || '-',
      format: eventFormat === 'virtual' ? 'Virtual' : 'In person',
      when: start ? formatLocalDatetime(start) : '-',
      whenMissing: !start,
      endWhen: end ? formatLocalDatetime(end) : 'Not set',
      location: loc || (eventFormat === 'virtual' ? 'Join details TBD' : '-'),
      host: org ? `${org.displayName} (/${org.slug})` : 'Personal listing',
      program: fullProgram && publishOrgId ? 'Convention program shell enabled' : 'Single event only',
      safety:
        eventFormat === 'in-person' ?
          [
            LOCATION_VISIBILITY_LABELS[locationVisibility],
            newcomerFriendly ? 'Newcomer-friendly' : null,
            attendeeListVisibility === 'public' ? 'Guest names visible' : 'Guest counts only',
          ]
            .filter(Boolean)
            .join(' · ')
        : `Virtual · ${virtualSessionStyle}`,
      description: draft.description.trim() || '-',
      cover:
        draft.imageUrl.trim() || draft.coverQuarantineKey.trim() ? 'Cover photo added' : 'No cover photo',
    }
  }

  const publishPreview = eventStep === 4 ? buildPreview() : null

  const footer = (
    <StickyWizardFooter
      leftLabel={eventStep === 1 ? 'Cancel' : 'Back'}
      onLeft={eventStep === 1 ? handleClose : () => setEventStep((s) => Math.max(1, s - 1))}
      onPrimary={eventStep === 4 ? () => void publishEvent() : goNext}
      primaryLabel={eventStep === 4 ? 'Publish event' : 'Continue'}
      primaryDisabled={eventStep === 4 && !isAuthenticated}
      primaryLoading={eventPublishing}
      primaryTestId={eventStep === 4 ? 'create-event-publish' : 'create-event-next'}
    />
  )

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title="Create event"
      description={stepDescription}
      variant="sheet"
      layout="wizard"
      maxWidthClass="max-w-2xl sm:rounded-2xl"
      className="create-flow cf-wizard-panel"
      panelRef={dialogRef}
      headerExtra={
        <button
          type="button"
          onClick={handleClose}
          className="cf-wizard-close shrink-0 rounded-lg p-2 text-dc-text-muted transition-colors hover:bg-dc-elevated-muted hover:text-dc-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)]"
          aria-label="Close create event"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      }
      footer={footer}
    >
      <CreateFlowStepper currentStep={eventStep} />

      {stepError ?
        <div className="cf-banner cf-banner--danger" role="alert">
          {stepError}
        </div>
      : null}

      {eventStep === 1 && (
        <div className="cf-step">
          {isMunchCategory ?
            <p className="cf-banner">
              Creating a <span className="font-medium text-dc-text">munch</span>
              {prefillGroupId ? ' for your group' : ''}. End time defaults to +2 hours; location often stays
              RSVP-only.
            </p>
          : null}

          <SectionCard title="Event type" badge="Required">
            <FormField id="create-event-category" label="Category">
              <select
                id="create-event-category"
                value={eventCategory}
                onChange={(e) => {
                  const next = e.target.value
                  setEventCategory(next)
                  if (next === 'Munch') setFullProgram(false)
                }}
                className={fieldSelectClass}
              >
                <option value="">Select a category</option>
                <option value="Munch">Munch</option>
                <option value="Social">Social</option>
                <option value="Workshop">Workshop</option>
                <option value="Educational">Educational</option>
                <option value="Conference/Festival">Conference/Festival</option>
                <option value="Play Party">Play Party</option>
              </select>
            </FormField>
            {isMunchCategory ?
              <p className="text-dc-micro text-dc-text-muted">
                Munches use RSVP on a single event. No convention program unless you opt in on the Host step.
              </p>
            : null}
            <FormField id="create-event-format" label="Format" hint="In person at a venue, or online with a join link.">
              <FormatToggle value={eventFormat} onChange={setEventFormat} />
            </FormField>
          </SectionCard>

          <SectionCard title="Core details" badge="Required">
            <FormField id="create-event-title" label="Event title">
              <TextInput
                id="create-event-title"
                type="text"
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                placeholder="e.g. Rope Jam and Workshop"
                autoComplete="off"
              />
            </FormField>
            <FormField
              id="create-event-location"
              label={eventFormat === 'virtual' ? 'Join link or platform' : 'Location'}
              hint={
                eventFormat === 'virtual' ?
                  'Zoom, Meet, or platform name. Link may be shown after RSVP.'
                : 'Venue name or address guests need to find you.'
              }
            >
              <TextInput
                id="create-event-location"
                type="text"
                value={draft.location}
                onChange={(e) => updateDraft({ location: e.target.value })}
                placeholder={
                  eventFormat === 'virtual' ? 'https://… or Discord' : 'e.g. The Copper Pot, Seattle'
                }
                autoComplete="off"
              />
            </FormField>
            <FormField id="create-event-datetime" label="Start date & time">
              <input
                id="create-event-datetime"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => updateDraft({ startsAt: e.target.value })}
                className={fieldDatetimeClass}
              />
            </FormField>
            <FormField
              id="create-event-ends"
              label="End date & time"
              hint="Optional. Munches default to +2 hours if left blank."
            >
              <input
                id="create-event-ends"
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => updateDraft({ endsAt: e.target.value })}
                className={fieldDatetimeClass}
              />
            </FormField>
          </SectionCard>

          <SectionCard title="Guest expectations" badge="Optional">
            <FormField id="create-event-dress" label="Dress code">
              <TextInput
                id="create-event-dress"
                type="text"
                value={draft.dressCode}
                onChange={(e) => updateDraft({ dressCode: e.target.value })}
                placeholder="e.g. Casual, venue-appropriate"
                autoComplete="off"
              />
            </FormField>
            <FormField id="create-event-cost" label="Expected cost">
              <TextInput
                id="create-event-cost"
                type="text"
                value={draft.expectedCostText}
                onChange={(e) => updateDraft({ expectedCostText: e.target.value })}
                placeholder="e.g. Free, $10–15, cash bar"
                autoComplete="off"
              />
            </FormField>
          </SectionCard>

          {eventFormat === 'in-person' ?
            <SectionCard title="Safety, address visibility, and capacity" variant="highlight">
              <FormField
                id="create-loc-vis"
                label="Who sees the full address"
                hint="Choose when street-level location details appear to guests."
              >
                <select
                  id="create-loc-vis"
                  value={locationVisibility}
                  onChange={(e) => setLocationVisibility(e.target.value as 'public' | 'rsvp' | 'approved')}
                  className={fieldSelectClass}
                >
                  <option value="public">Public. Everyone sees the address</option>
                  <option value="rsvp">
                    After RSVP. Street address for Going/{RSVP_LABEL_INTERESTED} only
                  </option>
                  <option value="approved">After host approval. You approve each guest</option>
                </select>
              </FormField>
              {locationVisibility !== 'public' ?
                <FormField
                  id="create-pub-sum"
                  label="Public location summary"
                  hint="Neighborhood or venue name without the full street address."
                >
                  <TextInput
                    id="create-pub-sum"
                    type="text"
                    value={draft.publicLocationSummary}
                    onChange={(e) => updateDraft({ publicLocationSummary: e.target.value })}
                    placeholder="e.g. Downtown Seattle · The Copper Pot"
                    autoComplete="off"
                  />
                </FormField>
              : null}
              <FormField
                id="create-screening"
                label="Screening question"
                hint="Optional question guests answer before attending."
              >
                <TextInput
                  id="create-screening"
                  type="text"
                  value={draft.screeningQuestion}
                  onChange={(e) => updateDraft({ screeningQuestion: e.target.value })}
                  placeholder="e.g. How did you hear about this munch?"
                  autoComplete="off"
                />
              </FormField>
              <WizardCheckbox
                id="create-newcomer"
                label="Newcomer-friendly"
                checked={newcomerFriendly}
                onChange={setNewcomerFriendly}
                description="Signals that first-timers are welcome."
              />
              <FormField id="create-access" label="Accessibility notes">
                <textarea
                  id="create-access"
                  rows={2}
                  value={draft.accessibilityNotes}
                  onChange={(e) => updateDraft({ accessibilityNotes: e.target.value })}
                  placeholder="e.g. Step-free entry, wheelchair-accessible restroom"
                  className={fieldTextareaClass}
                />
              </FormField>
              <FormField id="create-cap" label="Capacity max" hint="Leave blank for no listed capacity.">
                <TextInput
                  id="create-cap"
                  type="number"
                  min={1}
                  value={draft.capacityMax}
                  onChange={(e) => updateDraft({ capacityMax: e.target.value })}
                  placeholder="e.g. 25"
                />
              </FormField>
              <FormField
                id="create-att-vis"
                label="Guest list on event page"
                hint="Control how much attendance information appears on the event page."
              >
                <select
                  id="create-att-vis"
                  value={attendeeListVisibility}
                  onChange={(e) => setAttendeeListVisibility(e.target.value as 'public' | 'count_only')}
                  className={fieldSelectClass}
                >
                  <option value="public">Show names (committed “going”)</option>
                  <option value="count_only">Counts only for visitors (you still see names)</option>
                </select>
              </FormField>
            </SectionCard>
          : (
            <SectionCard title="Virtual event details" variant="highlight">
              <FormField id="create-event-vstyle" label="Session style">
                <select
                  id="create-event-vstyle"
                  value={virtualSessionStyle}
                  onChange={(e) => setVirtualSessionStyle(e.target.value as 'social' | 'education' | 'mixed')}
                  className={fieldSelectClass}
                >
                  <option value="social">Social (munch / hangout)</option>
                  <option value="education">Class / webinar</option>
                  <option value="mixed">Mixed (social + teaching)</option>
                </select>
              </FormField>
              {(virtualSessionStyle === 'education' || virtualSessionStyle === 'mixed') && (
                <>
                  <FormField
                    id="create-event-agenda"
                    label="Agenda / outline"
                    hint="Optional now, or add a full timed program after publish."
                  >
                    <textarea
                      id="create-event-agenda"
                      rows={3}
                      value={draft.virtualAgenda}
                      onChange={(e) => updateDraft({ virtualAgenda: e.target.value })}
                      placeholder="e.g. 0:00 welcome · 0:10 demo · 0:40 Q&A"
                      className={fieldTextareaClass}
                    />
                  </FormField>
                  <FormField id="create-event-materials" label="Materials link">
                    <TextInput
                      id="create-event-materials"
                      type="url"
                      value={draft.materialsUrl}
                      onChange={(e) => updateDraft({ materialsUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </FormField>
                </>
              )}
              <FormField id="create-event-recording" label="Recording availability">
                <select
                  id="create-event-recording"
                  value={recordingPolicy}
                  onChange={(e) => setRecordingPolicy(e.target.value as typeof recordingPolicy)}
                  className={fieldSelectClass}
                >
                  <option value="">Not specified</option>
                  <option value="not_recorded">Not recorded</option>
                  <option value="live_only">Live only (no recording)</option>
                  <option value="shared_with_registrants">Recorded · shared with attendees</option>
                  <option value="tbd">TBD</option>
                </select>
              </FormField>
              <FormField
                id="create-event-tz"
                label="Event timezone"
                hint="IANA name, e.g. America/New_York"
              >
                <TextInput
                  id="create-event-tz"
                  type="text"
                  value={draft.eventTimezone}
                  onChange={(e) => updateDraft({ eventTimezone: e.target.value })}
                  placeholder="America/New_York"
                  autoComplete="off"
                />
              </FormField>
            </SectionCard>
          )}
        </div>
      )}

      {eventStep === 2 && (
        <div className="cf-step">
          <SectionCard title="Marketing" badge="Recommended">
            <EventCoverPhotoControl
              imageUrl={draft.imageUrl.trim() || null}
              onChange={(url) => updateDraft({ imageUrl: url ?? '' })}
              onQuarantineKeyChange={(key) => updateDraft({ coverQuarantineKey: key ?? '' })}
              canUpload={isAuthenticated}
              disabled={eventPublishing}
            />
            <FormField
              id="create-event-description"
              label="Description"
              hint="What happens, who it is for, and anything guests should prepare."
            >
              <textarea
                id="create-event-description"
                rows={6}
                value={draft.description}
                onChange={(e) => updateDraft({ description: e.target.value })}
                placeholder="Describe the event for guests browsing the calendar."
                className={fieldTextareaClass}
              />
            </FormField>
          </SectionCard>
        </div>
      )}

      {eventStep === 3 && (
        <div className="cf-step">
          {isConventionCreate ?
            <p className="cf-banner">
              You are creating an event with an optional <span className="font-medium text-dc-text">convention program shell</span>.
              Enable the program below when posting to an organization calendar.
            </p>
          : null}
          <SectionCard title="Where this event lives">
            <p className="text-sm text-dc-text-muted">
              Post to an organization calendar only if you are a moderator or higher there. Leave unset for a
              personal listing.
              {eventFormat === 'virtual' ?
                <span className="mt-2 block">
                  Virtual classes can use the agenda from Basics, or add a full timed program after publish.
                </span>
              : null}
            </p>
            {publishOrgs.length > 0 ?
              <FormField
                id="create-event-org"
                label="Organization calendar"
                hint="Optional. Lists the event on that org's calendar."
              >
                <select
                  id="create-event-org"
                  value={publishOrgId}
                  onChange={(e) => {
                    setPublishOrgId(e.target.value)
                    if (!e.target.value) setFullProgram(false)
                  }}
                  className={fieldSelectClass}
                >
                  <option value="">Personal listing (no org)</option>
                  {publishOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.displayName} (/{o.slug})
                    </option>
                  ))}
                </select>
              </FormField>
            : isAuthenticated ?
              <p className="text-sm text-dc-text-muted">No org calendars you can publish to (moderator+ required).</p>
            : (
              <p className="text-sm text-dc-text-muted">Log in to see organization calendars you can publish to.</p>
            )}
            {prefillGroupId ?
              <p className="text-dc-micro text-dc-text-muted">
                This event will be associated with your group when published.
              </p>
            : null}
            {(() => {
              const shellOrg = publishOrgs.find((o) => o.id === publishOrgId)
              const canShell = Boolean(shellOrg?.canCreateConventionShell)
              const shellDisabled = !publishOrgId || !canShell
              const shellDesc =
                !publishOrgId ? 'Select an organization calendar first.'
                : !canShell ?
                  'Convention shell requires org owner or admin (not moderator alone).'
                : 'You can add classes and times after publish.'
              return !isMunchCategory ?
                  <WizardCheckbox
                    id="create-full-program"
                    label="Add full program (convention-style schedule shell)"
                    checked={fullProgram && canShell}
                    disabled={shellDisabled}
                    onChange={(v) => setFullProgram(canShell && v)}
                    description={shellDesc}
                  />
                : (
                  <WizardCheckbox
                    id="create-full-program-munch"
                    label="Also add full program (convention shell)"
                    checked={fullProgram && canShell}
                    disabled={shellDisabled}
                    onChange={(v) => setFullProgram(canShell && v)}
                    description={canShell ? 'Optional for munches; most stay RSVP-only on a single event.' : shellDesc}
                  />
                )
            })()}
            {!publishOrgId && fullProgram ?
              <p className="text-dc-micro text-dc-danger">Select an organization to enable the program shell.</p>
            : null}
          </SectionCard>
        </div>
      )}

      {eventStep === 4 && publishPreview ?
        <div className="cf-step">
          {eventPublishError ?
            <div className="cf-banner cf-banner--danger" role="alert">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="flex-1">{eventPublishError}</p>
                <button
                  type="button"
                  onClick={() => setEventPublishError(null)}
                  className="min-h-10 shrink-0 rounded-lg border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
                >
                  Dismiss
                </button>
              </div>
            </div>
          : null}
          {!isAuthenticated ?
            <p className="cf-banner">
              Log in to publish this event.
            </p>
          : null}
          {(publishPreview.titleMissing || publishPreview.whenMissing) && !eventPublishError ?
            <p className="cf-banner cf-banner--danger" role="alert">
              Complete title and start time on the Basics step before publishing.
            </p>
          : null}
          <PreviewSummary>
            <PreviewRow label="Title" value={publishPreview.title || 'Not set'} missing={publishPreview.titleMissing} />
            <PreviewRow label="Category" value={publishPreview.category} />
            <PreviewRow label="Format" value={publishPreview.format} />
            <PreviewRow label="When" value={publishPreview.when} missing={publishPreview.whenMissing} />
            <PreviewRow label="Ends" value={publishPreview.endWhen} />
            <PreviewRow label="Location" value={publishPreview.location} />
            <PreviewRow label="Host" value={publishPreview.host} />
            <PreviewRow label="Program" value={publishPreview.program} />
            <PreviewRow label="Safety & visibility" value={publishPreview.safety} />
            <PreviewRow label="Cover photo" value={publishPreview.cover} />
            <PreviewRow label="Description" value={publishPreview.description} />
          </PreviewSummary>
        </div>
      : null}
    </Dialog>
  )
}
